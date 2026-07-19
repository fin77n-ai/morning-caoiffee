const { contentProfile } = require('./contentProfile');

function optimizeContent(data, profile = contentProfile, options = {}) {
  const dropped = { blocked: 0, offTopic: 0, repeated: 0, crossSource: 0, stale: 0 };
  const excludeKeys = options.excludeKeys instanceof Set ? options.excludeKeys : new Set();
  // 跨源去重共享一个 seen：官方博客 > HN > GitHub > Reddit > 播客，
  // 同一条大新闻不再以三种身份刷屏
  const seen = new Set();
  const optimized = { sourceHealth: data.sourceHealth || [] };
  const groupOrder = ['aiBlogs', 'hackerNews', 'githubTrending', 'reddit', 'podcasts'];
  for (const groupName of groupOrder) {
    optimized[groupName] = optimizeGroup(data[groupName], groupName, profile, dropped, seen, excludeKeys);
  }

  optimized.optimization = {
    profileVersion: profile.version,
    generatedAt: new Date().toISOString(),
    inputCounts: countGroups(data),
    outputCounts: countGroups(optimized),
    droppedCounts: dropped,
    failedSources: (optimized.sourceHealth || []).filter((source) => source.status === 'failed').length,
    note: 'Items were ranked, deduped (cross-source + sent-history), blocklist-filtered, freshness-decayed, and capped.',
  };

  return optimized;
}

// 新鲜度只约束有独立发布日期的低频源；HN/GitHub/Reddit 本身就是当日榜，不惩罚
const FRESHNESS_GROUPS = new Set(['aiBlogs', 'podcasts']);
const MAX_AGE_DAYS = 14;
const FRESHNESS_HALF_LIFE_DAYS = 3;

function freshnessFactor(item, groupName) {
  if (!FRESHNESS_GROUPS.has(groupName) || !item.pubDate) return { factor: 1, stale: false };
  const ageDays = (Date.now() - Date.parse(item.pubDate)) / 86400000;
  if (!Number.isFinite(ageDays) || ageDays < 0) return { factor: 1, stale: false };
  if (ageDays > MAX_AGE_DAYS) return { factor: 0, stale: true };
  return { factor: Math.exp(-ageDays / FRESHNESS_HALF_LIFE_DAYS), stale: false };
}

function optimizeGroup(items = [], groupName, profile, dropped, seen = new Set(), excludeKeys = new Set()) {
  const ranked = [];
  const requireMatch = (profile.requireTopicMatch ?? []).includes(groupName);

  for (const item of items) {
    const key = duplicateKey(item);
    if (!key) continue;
    if (seen.has(key)) {
      dropped.crossSource += 1;
      continue;
    }
    seen.add(key);

    if (excludeKeys.has(key)) {
      dropped.repeated += 1;
      continue;
    }

    const text = searchableText(item);
    if (isBlocked(text, profile)) {
      dropped.blocked += 1;
      continue;
    }

    const fresh = freshnessFactor(item, groupName);
    if (fresh.stale) {
      dropped.stale += 1;
      continue;
    }

    const scored = scoreItem(item, groupName, profile);
    if (requireMatch && scored.matches === 0) {
      dropped.offTopic += 1;
      continue;
    }
    scored.score *= fresh.factor;
    ranked.push(scored);
  }

  ranked.sort((a, b) => b.score - a.score);

  const limit = profile.limits[groupName] ?? ranked.length;
  const selected = ranked.slice(0, limit);

  return selected.map((item, index) => ({
    ...item.original,
    category: item.category,
    categoryLabel: item.categoryLabel,
    optimizationScore: Number(item.score.toFixed(2)),
    rank: index + 1,
    reason: item.reason,
  }));
}

function scoreItem(item, groupName, profile) {
  const text = searchableText(item);
  const topic = bestTopic(text, profile);
  const sourceWeight = profile.sourceWeights[groupName] ?? 1;
  const socialBoost = socialSignalBoost(item, groupName);
  const sourceBoost = sourceQualityBoost(item);
  const score = (topic.matches + 1) * topic.weight * sourceWeight
    + socialBoost
    + sourceBoost;

  return {
    original: item,
    category: topic.name,
    categoryLabel: topic.label,
    matches: topic.matches,
    score,
    reason: buildReason(topic, sourceBoost, socialBoost),
  };
}

// 词边界匹配：'eval' 不再命中 retrieval，'app' 不再命中 happy
function keywordHits(text, keywords) {
  return keywords.filter((keyword) =>
    new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)
  ).length;
}

function isBlocked(text, profile) {
  const blockHits = keywordHits(text, profile.blockKeywords ?? []);
  if (!blockHits) return false;
  return keywordHits(text, profile.blockExemptions ?? []) === 0;
}

function bestTopic(text, profile) {
  let best = {
    name: 'generalAI',
    label: 'general AI signal',
    weight: 1,
    matches: 0,
  };

  for (const [name, topic] of Object.entries(profile.topics)) {
    const matches = keywordHits(text, topic.keywords);
    const weightedMatches = matches * topic.weight;
    const bestWeightedMatches = best.matches * best.weight;
    if (weightedMatches > bestWeightedMatches) {
      best = { name, label: topic.label, weight: topic.weight, matches };
    }
  }

  return best;
}

function searchableText(item) {
  return [
    item.title,
    item.name,
    item.description,
    item.summary,
    item.source,
    item.author,
    item.subreddit,
    item.podcast,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function duplicateKey(item) {
  const url = item.url || item.link;
  if (url && url !== '#') return normalize(url);
  return normalize(item.title || item.name || '');
}

function normalize(value) {
  let str = String(value).toLowerCase().trim();
  if (/^https?:\/\//.test(str)) {
    str = str.replace(/^https?:\/\/(www\.)?/, '').replace(/#.*$/, '');
    // 只剥跟踪参数：?v=xxx 这类有意义的 query 必须保留，否则不同 YouTube 视频会被误判为同一条
    const [path, query = ''] = str.split('?');
    const kept = query
      .split('&')
      .filter((part) => part && !/^(utm_|ref=|ref_|fbclid=|gclid=|source=)/.test(part))
      .sort();
    str = kept.length ? `${path}?${kept.join('&')}` : path;
  }
  // 白名单加入 CJK：纯中文标题不再被归一成空串而整条静默丢弃
  return str.replace(/[^a-z0-9぀-ヿ一-鿿가-힯]+/g, ' ').trim();
}

function socialSignalBoost(item, groupName) {
  if (groupName === 'reddit') {
    return Math.min((item.score || 0) / 500, 1.5) + Math.min((item.comments || 0) / 150, 1);
  }

  if (groupName === 'hackerNews') {
    return Math.min((item.points || 0) / 300, 1.5) + Math.min((item.comments || 0) / 200, 1);
  }

  if (groupName === 'githubTrending') {
    // 今日新增星才反映"正在热"，总星数只是资历；有今日数据时优先用
    const today = parseStars(item.starsToday);
    if (today > 0) return Math.min(today / 500, 1.5);
    return Math.min(parseStars(item.stars) / 5000, 1.5);
  }

  return 0;
}

function sourceQualityBoost(item) {
  const source = String(item.author || item.source || item.podcast || '').toLowerCase();
  if (/openai|anthropic|deepmind|hugging face|hf daily|google ai|qwen|simon willison|the batch/.test(source)) return 0.5;
  return 0;
}

function parseStars(value = '') {
  const clean = String(value).replace(/,/g, '').trim();
  const match = clean.match(/([\d.]+)\s*k/i);
  if (match) return Number(match[1]) * 1000;
  const raw = clean.match(/\d+/);
  return raw ? Number(raw[0]) : 0;
}

function buildReason(topic, sourceBoost, socialBoost) {
  const reasons = [topic.label];
  if (sourceBoost > 0) reasons.push('trusted source');
  if (socialBoost > 0) reasons.push('community signal');
  return reasons.join(' + ');
}

function countGroups(data) {
  return {
    hackerNews: data.hackerNews?.length || 0,
    githubTrending: data.githubTrending?.length || 0,
    podcasts: data.podcasts?.length || 0,
    reddit: data.reddit?.length || 0,
    aiBlogs: data.aiBlogs?.length || 0,
  };
}

module.exports = { optimizeContent, normalize };
