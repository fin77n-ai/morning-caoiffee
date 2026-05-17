const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

async function summarize(data) {
  console.log('Asking DeepSeek to summarize...');

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const podcastSection = data.podcasts && data.podcasts.length > 0
    ? data.podcasts.map((p, i) => `${i + 1}. [${p.podcast}] ${p.title} | ${p.link} | ${p.description}`).join('\n')
    : 'No new episodes today.';

  const redditSection = data.reddit && data.reddit.length > 0
    ? data.reddit.map((p, i) => `${i + 1}. [r/${p.subreddit}] ${p.title} | ${p.url} | 👍 ${p.score} | 💬 ${p.comments}`).join('\n')
    : 'No Reddit posts today.';

  const aiBlogsSection = data.aiBlogs && data.aiBlogs.length > 0
    ? data.aiBlogs.map((b, i) => `${i + 1}. [${b.author}] ${b.title} | ${b.link} | ${b.summary}`).join('\n')
    : 'No blog posts today.';

  const prompt = `
You are a curious, bilingual friend who loves AI and tech. Today's date is ${today}.
Below is fresh data from Hacker News, GitHub Trending, Reddit AI communities, AI thought-leader blogs, and the latest podcast episodes.
Write a short, fun morning digest — 5 minutes max to read.

Output exactly 6 HTML sections using the CSS classes below. No <html>, no <head>, no <style>, no <body>. Just the 6 sections.

─── CSS CLASSES TO USE ───
Each section: <div class="section">
Section title: <div class="section-title">🔥 标题文字</div>
Story/repo/buzz card: <div class="card"><div class="badge">标签</div><h3><a href="URL">标题</a></h3><p>评论</p></div>
AI Term section: <div class="term-card"><h2>术语名</h2><p>解释</p></div>
Curiosity section: <div class="curiosity-card"><p class="question">问题？</p><p>延伸思考</p></div>
Podcast section: <div class="podcast-card"><h3>播客标题</h3><p>内容</p></div>
─────────────────────────

Section 1 — <div class="section-title">🔥 最有意思的 2-3 条</div>
- Pick 2-3 most FUN or thought-provoking Hacker News items
- Use .card with badge = source/topic, h3 = clickable title, p = 1-2 sentences of commentary
- Ask: would a curious person want to talk about this over coffee?

Section 2 — <div class="section-title">⭐ GitHub 今日最热</div>
- Pick 3 most interesting trending repos
- Use .card with badge = language/topic, h3 = clickable repo name, p = one punchy sentence

Section 3 — <div class="section-title">🤖 AI 圈在聊什么</div>
- Pick 2-3 Reddit AI posts + 1 blog highlight if interesting
- Use .card with badge = subreddit/source, h3 = clickable title, p = why community is excited
- Tone: friend who lurked AI forums and found the spicy discussions

Section 4 — <div class="section-title">🧠 今日 AI 词</div>
- Pick one AI/tech term from today's data
- Use a single .term-card
- Explain in 中英混搭, fun analogy, under 80 words

Section 5 — <div class="section-title">💭 今日好奇</div>
- Use a single .curiosity-card with class="question" on the opening question
- 2-3 sentences exploring the thought
- 从技术延伸到本质，允许反直觉结论，像朋友聊天

Section 6 — <div class="section-title">🎙 访谈速读</div>
- If no new podcast episodes: skip this entire section
- Use .podcast-card: h3 = episode title, p = 3 sentences (guest + big idea + why it matters) + 1-2 term explanations

Tone & style:
- 中英混搭, humorous but smart, late-night talk show energy
- Short > long. Punchy > thorough.
- Total text under 1400 words
- Example vibe: "OpenAI 又发布新模型了。上一个版本的用户表示：我还没搞懂上上个版本，谢谢。"

IMPORTANT: Output ONLY the 6 section divs. No markdown, no code fences, no outer HTML tags.

--- DATA ---
Hacker News Top Stories:
${data.hackerNews.map((item, i) => `${i + 1}. ${item.title} | ${item.url}`).join('\n')}

GitHub Trending Repos:
${data.githubTrending.map((item, i) => `${i + 1}. ${item.name} | ${item.url} | ${item.description} | ⭐ ${item.stars}`).join('\n')}

Reddit AI Community Posts:
${redditSection}

AI Thought-Leader Blog Posts:
${aiBlogsSection}

Latest Podcast Episodes:
${podcastSection}
`;

  const completion = await client.chat.completions.create({
    model: 'deepseek-v4-pro',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  return completion.choices[0].message.content
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

module.exports = { summarize };
