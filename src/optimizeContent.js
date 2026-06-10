const { contentProfile } = require('./contentProfile');

function optimizeContent(data, profile = contentProfile) {
  const optimized = {
    hackerNews: optimizeGroup(data.hackerNews, 'hackerNews', profile),
    githubTrending: optimizeGroup(data.githubTrending, 'githubTrending', profile),
    podcasts: optimizeGroup(data.podcasts, 'podcasts', profile),
    reddit: optimizeGroup(data.reddit, 'reddit', profile),
    aiBlogs: optimizeGroup(data.aiBlogs, 'aiBlogs', profile),
    dataTools: optimizeGroup(data.dataTools, 'dataTools', profile),
    sourceHealth: data.sourceHealth || [],
  };

  optimized.optimization = {
    profileVersion: profile.version,
    generatedAt: new Date().toISOString(),
    inputCounts: countGroups(data),
    outputCounts: countGroups(optimized),
    failedSources: (optimized.sourceHealth || []).filter((source) => source.status === 'failed').length,
    note: 'Items were ranked, deduped, and capped before summarization.',
  };

  return optimized;
}

function optimizeGroup(items = [], groupName, profile) {
  const seen = new Set();
  const ranked = [];

  for (const item of items) {
    const key = duplicateKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ranked.push(scoreItem(item, groupName, profile));
  }

  ranked.sort((a, b) => b.score - a.score);

  const limit = profile.limits[groupName] ?? ranked.length;
  const selected = ranked.slice(0, limit);
  const wildcard = ranked
    .slice(limit)
    .find((item) => item.category !== selected[0]?.category && item.score >= 1.2);

  if (wildcard && selected.length > 2) {
    selected[selected.length - 1] = wildcard;
    selected.sort((a, b) => b.score - a.score);
  }

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
  const freshnessBoost = item.pubDate ? 0.05 : 0;
  const score = (topic.matches + 1) * topic.weight * sourceWeight
    + socialBoost
    + sourceBoost
    + freshnessBoost;

  return {
    original: item,
    category: topic.name,
    categoryLabel: topic.label,
    score,
    reason: buildReason(topic, sourceBoost, socialBoost),
  };
}

function bestTopic(text, profile) {
  let best = {
    name: 'generalAI',
    label: 'general AI signal',
    weight: 1,
    matches: 0,
  };

  for (const [name, topic] of Object.entries(profile.topics)) {
    const matches = topic.keywords.filter((keyword) => text.includes(keyword)).length;
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
  return String(value)
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/[?#].*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function socialSignalBoost(item, groupName) {
  if (groupName === 'reddit') {
    return Math.min((item.score || 0) / 500, 1.5) + Math.min((item.comments || 0) / 150, 1);
  }

  if (groupName === 'githubTrending') {
    const stars = parseStars(item.stars);
    return Math.min(stars / 5000, 1.5);
  }

  return 0;
}

function sourceQualityBoost(item) {
  const source = String(item.author || item.source || item.podcast || '').toLowerCase();
  if (/openai|deepmind|hugging face|google ai|simon willison|the batch/.test(source)) return 0.5;
  if (/duckdb|sqlite|chroma/.test(source)) return 0.15;
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
    dataTools: data.dataTools?.length || 0,
  };
}

module.exports = { optimizeContent };
