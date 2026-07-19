require('dotenv').config();
const OpenAI = require('openai');
const { scrapeAll } = require('../src/scraper');
const { optimizeContent } = require('../src/optimizeContent');
const { loadRecentKeys } = require('../src/sentHistory');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

async function generateTelegramDigest() {
  const rawData = await scrapeAll();
  // 近 7 天发过的条目直接不进候选池（读失败 fail-open 为空集，宁重复勿沉默）
  const excludeKeys = loadRecentKeys();
  const data = optimizeContent(rawData, undefined, { excludeKeys });
  logSourceHealth(data);
  const digest = await summarizeForTelegram(data);
  warnUnknownUrls(digest, data);
  return digest;
}

// 源健康只进 Actions 日志，不占读者正文
function logSourceHealth(data) {
  const health = data.sourceHealth || [];
  const failed = health.filter((source) => source.status === 'failed');
  console.log(`Source health: ${health.length - failed.length}/${health.length} ok`);
  for (const source of failed) {
    console.log(`- FAILED ${source.source}: ${source.error || 'unknown'}`);
  }
  if (data.optimization?.droppedCounts) {
    console.log(`Dropped: ${JSON.stringify(data.optimization.droppedCounts)}`);
  }
}

// 防链接幻觉的最后一道闸：先只告警观察，确认误报率再考虑剔除
function warnUnknownUrls(digest, data) {
  // 剥锚点再比对：Simon Willison 的 atom 链接自带 #atom-everything 这类 fragment，会造成假阳性
  const canonical = (url) => url.replace(/#.*$/, '').replace(/[.,;:!?]*$/, '').replace(/\/+$/, '');
  const known = new Set();
  for (const group of ['hackerNews', 'githubTrending', 'reddit', 'aiBlogs', 'podcasts']) {
    for (const item of data[group] || []) {
      for (const url of [item.url, item.link, item.commentsUrl]) {
        if (url) known.add(canonical(url));
      }
    }
  }
  const used = digest.match(/https?:\/\/[^\s)>\]]+/g) || [];
  for (const url of used) {
    if (!known.has(canonical(url))) {
      console.warn(`WARN unknown URL in digest (possible hallucination): ${url}`);
    }
  }
}

async function main() {
  console.log('Morning cAoIffee Telegram digest is brewing...');
  const digest = await generateTelegramDigest();
  console.log('\n--- TELEGRAM_DIGEST_START ---');
  console.log(digest.trim());
  console.log('--- TELEGRAM_DIGEST_END ---');
}

async function summarizeForTelegram(data, attempt = 1) {
  const prompt = buildTelegramPrompt(data);
  const completion = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    max_tokens: 2200,
    messages: [{ role: 'user', content: prompt }],
  });

  // 被 max_tokens 拦腰截断的稿子不能发出去，重试一次
  if (completion.choices[0].finish_reason === 'length' && attempt < 2) {
    console.warn('Digest truncated by max_tokens, retrying once...');
    return summarizeForTelegram(data, attempt + 1);
  }

  return completion.choices[0].message.content
    .replace(/^```(?:text)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function buildTelegramPrompt(data) {
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: process.env.DIGEST_TZ || 'Asia/Shanghai',
  });

  return `
You are D, a witty bilingual AI-news editor writing a Telegram morning digest for one reader.
Today is ${today}.
Write in Simplified Chinese with light English terms when natural.
This will be read inside Telegram on a phone. Make it much clearer than an email:
- Short sections.
- Short paragraphs.
- No HTML.
- No markdown table.
- No code fence.
- No long bullet walls.
- Prefer concrete "what happened / why it matters / what to watch" over generic summaries.
- Preserve product, model, company, and project names exactly as written in DATA.
Max 1600 Chinese characters. Tight and punchy beats complete.
If a source failed, do not invent content from it.

Format exactly:
☕ Morning cAoIffee · ${today}

先看这 3 件事
1. Headline
   为什么重要：...
   继续观察：...
   链接：URL

2. Headline
   为什么重要：...
   继续观察：...
   链接：URL

3. Headline
   为什么重要：...
   继续观察：...
   链接：URL

━━━━━━━━━━━━
最值得点开
1. Title
   看点：...
   链接：URL

2. Title
   看点：...
   链接：URL

━━━━━━━━━━━━
开源 / GitHub
1. Repo
   能做什么：...
   链接：URL

2. Repo
   能做什么：...
   链接：URL

━━━━━━━━━━━━
社区信号
1. Reddit/HN topic
   这帖在聊什么：...
   为什么值得围观：...
   链接：URL

2. Reddit/HN topic
   这帖在聊什么：...
   为什么值得围观：...
   链接：URL

━━━━━━━━━━━━
概念卡片
概念：Term
一句话解释：...
今天为什么出现：...
我该怎么记：...

━━━━━━━━━━━━
今天留给我的问题
问题：...
为什么值得想：...

Selection rules:
- Use the highest ranked items first.
- Prefer frontier models, agents, coding tools, open-source models, evals/safety, multimodal AI, developer tools, and important community debates.
- Do not over-focus on RAG/data tooling unless the item is genuinely important today.
- 同一事件全篇只允许出现一次：已进"先看这 3 件事"的条目不得再出现在其他栏目。
- Every URL you write must be copied verbatim from DATA. Never construct or guess a URL.
- For 社区信号, describe only what the title/metadata supports — do not invent debates or comment threads. Prefer the discussion URL when DATA provides one.
- If GitHub has no strong item, write "今天没有特别值得追的 GitHub 项目。"
- Keep each item to 2-3 short lines. Telegram hates giant paragraphs. Be kind to thumbs.

DATA
Hacker News:
${formatItems(data.hackerNews, (item) => `${item.title} | ${item.url} | ${item.points || 0} points, ${item.comments || 0} comments | discussion: ${item.commentsUrl || item.url} | ${meta(item)}`)}

GitHub Trending:
${formatItems(data.githubTrending, (item) => `${item.name} | ${item.url} | ${item.description || ''} | ${item.stars || ''} | ${meta(item)}`)}

Reddit:
${formatItems(data.reddit, (item) => `${item.title} | ${item.url} | score ${item.score || 0} | comments ${item.comments || 0} | ${meta(item)}`)}

AI Blogs:
${formatItems(data.aiBlogs, (item) => `${item.title} | ${item.link} | ${item.summary || ''} | ${meta(item)}`)}

Podcasts:
${formatItems(data.podcasts, (item) => `${item.title} | ${item.link} | ${item.description || ''} | ${meta(item)}`)}
`;
}

function formatItems(items = [], formatter) {
  if (!items.length) return 'None';
  return items.map((item, index) => `${index + 1}. ${formatter(item)}`).join('\n');
}

function meta(item) {
  return item.rank ? `rank ${item.rank}` : '';
}

module.exports = { generateTelegramDigest };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
