require('dotenv').config();
const OpenAI = require('openai');
const { scrapeAll } = require('../src/scraper');
const { optimizeContent } = require('../src/optimizeContent');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

async function generateTelegramDigest() {
  const rawData = await scrapeAll();
  const data = optimizeContent(rawData);
  return summarizeForTelegram(data);
}

async function main() {
  console.log('Morning cAoIffee Telegram digest is brewing...');
  const digest = await generateTelegramDigest();
  console.log('\n--- TELEGRAM_DIGEST_START ---');
  console.log(digest.trim());
  console.log('--- TELEGRAM_DIGEST_END ---');
}

async function summarizeForTelegram(data) {
  const prompt = buildTelegramPrompt(data);
  const completion = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    max_tokens: 2200,
    messages: [{ role: 'user', content: prompt }],
  });

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
  });
  const failedSources = (data.sourceHealth || [])
    .filter((source) => source.status === 'failed')
    .map((source) => source.source);

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
Max 3200 Chinese characters.
If a source failed, do not invent content from it.

Format exactly:
☕ Morning cAoIffee · ${today}

先看这 3 件事
1. Headline
   为什么重要：...
   继续观察：...

2. Headline
   为什么重要：...
   继续观察：...

3. Headline
   为什么重要：...
   继续观察：...

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
   大家在争什么：...
   我的判断：...
   链接：URL

2. Reddit/HN topic
   大家在争什么：...
   我的判断：...
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

━━━━━━━━━━━━
源健康
Status line only.

${data.sourceHealth.length - failedSources.length}/${data.sourceHealth.length} ok${failedSources.length ? `; failed: ${failedSources.join(', ')}` : ''}

Selection rules:
- Use the highest ranked items first.
- Prefer frontier models, agents, coding tools, open-source models, evals/safety, multimodal AI, developer tools, and important community debates.
- Do not over-focus on RAG/data tooling unless the item is genuinely important today.
- Every item in "最值得点开", "开源 / GitHub", and "社区信号" must include a real URL from DATA.
- If GitHub has no strong item, write "今天没有特别值得追的 GitHub 项目。"
- Keep each item to 2-3 short lines. Telegram hates giant paragraphs. Be kind to thumbs.

DATA
Hacker News:
${formatItems(data.hackerNews, (item) => `${item.title} | ${item.url} | ${meta(item)}`)}

GitHub Trending:
${formatItems(data.githubTrending, (item) => `${item.name} | ${item.url} | ${item.description || ''} | ${item.stars || ''} | ${meta(item)}`)}

Reddit:
${formatItems(data.reddit, (item) => `${item.title} | ${item.url} | score ${item.score || 0} | comments ${item.comments || 0} | ${meta(item)}`)}

AI Blogs:
${formatItems(data.aiBlogs, (item) => `${item.title} | ${item.link} | ${item.summary || ''} | ${meta(item)}`)}

Data Tools:
${formatItems(data.dataTools, (item) => `${item.title} | ${item.link} | ${item.summary || ''} | ${meta(item)}`)}

Podcasts:
${formatItems(data.podcasts, (item) => `${item.title} | ${item.link} | ${item.description || ''} | ${meta(item)}`)}
`;
}

function formatItems(items = [], formatter) {
  if (!items.length) return 'None';
  return items.map((item, index) => `${index + 1}. ${formatter(item)}`).join('\n');
}

function meta(item) {
  return [
    item.rank ? `rank ${item.rank}` : '',
    item.categoryLabel || '',
    item.reason || '',
  ].filter(Boolean).join(' / ');
}

module.exports = { generateTelegramDigest };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
