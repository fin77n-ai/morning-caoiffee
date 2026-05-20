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
Write a short, fun morning digest email — 5 minutes max to read.

Structure your response as HTML with exactly these 6 sections:

1. 🔥 最有意思的 2-3 条 (Most Interesting Stories)
   - Pick the 2-3 most FUN or thought-provoking items from Hacker News
   - Each gets a clickable title + 1-2 sentences of commentary
   - Ask yourself: would a curious person want to talk about this over coffee?

2. ⭐ GitHub 今日最热 (GitHub Trending Top 3)
   - Pick the 3 most interesting repos from the trending list
   - Each gets a clickable repo name + one punchy sentence on what it does + why it's cool

3. 🤖 AI 圈在聊什么 (AI Community Buzz)
   - Pick 2-3 most interesting posts from Reddit AI communities
   - Also include 1 highlight from the AI blogs if it's interesting
   - Tone: like a friend who's been lurking on the AI forums and found the spicy discussions

4. 🧠 AI Term of the Day
   - Pick one AI/tech term from today's news or community buzz
   - Explain it in 中英混搭 like you're texting a smart friend who's not a nerd
   - Use a fun analogy, keep it under 80 words

5. 💭 今日好奇 (Today's Curiosity)
   - Start with one question sparked by today's news
   - Then extend it — 2-3 sentences exploring the thought, like a friend who just can't stop thinking about it

6. 🎙 访谈速读 (Podcast Spotlight)
   - Pick the most interesting recent episode from the podcasts list below
   - Write 3 sentences: who's the guest, what's the big idea, why it matters
   - If no new episodes, skip this section entirely

Reader context (use this to pick & frame stories):
- The reader is currently building RAG systems and doing data analysis
- Their daily stack: Python, SQL, SQLite, Pandas, vector databases
- When a story touches RAG, embeddings, vector search, LLM + data pipelines, SQL/database tooling, or data analysis — prioritize it and go slightly deeper
- For the 🧠 AI Term of the Day: strongly prefer terms from this space (e.g. chunking strategies, hybrid search, reranking, query expansion, columnar storage, query planner, etc.)
- For 💭 今日好奇: lean toward questions that connect today's news to data/RAG practice
- If nothing in today's data is relevant to this space, just pick the most interesting story as usual — don't force it

Tone & style:
- 中英混搭, humorous but smart, late-night talk show energy
- Short > long. Punchy > thorough.
- Total text under 1400 words
- Example vibe: "OpenAI 又发布新模型了。上一个版本的用户表示：我还没搞懂上上个版本，谢谢。"

IMPORTANT: Output ONLY raw HTML. Do not wrap in markdown. Do not include \`\`\`html or \`\`\`. Start directly with <!DOCTYPE html>.

STYLING REQUIREMENTS — follow these exactly:
- The <head> MUST include these two meta tags to prevent email clients from inverting the dark theme:
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
- The <head> MUST also include this <style> block (this is the only allowed <style> block):
  <style>:root{color-scheme:dark}body{color-scheme:dark}</style>
- The <html> tag must have: style="color-scheme:dark"
- The outermost <body> tag must have: style="background-color:#0f0f0f;margin:0;padding:0;color-scheme:dark"
- Overall background: #0f0f0f (near-black), body text: #e8e8e8
- Max-width 640px, centered, font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- Header banner: bold gradient background (e.g. linear-gradient(135deg, #1a1a2e, #16213e)), large white title "☕ Morning cAoIffee", subtitle with today's date in smaller muted text
- Each of the 6 sections gets its own card: background #1a1a1a, border-radius 12px, padding 20px 24px, margin-bottom 16px
- Section title: colored accent bar on the left (4px solid), use a distinct color per section:
  🔥 red #ff4757 | ⭐ yellow #ffd32a | 🤖 purple #7d5fff | 🧠 cyan #18dcff | 💭 green #0be881 | 🎙 orange #ff9f43
- Section title text: 15px, font-weight 700, letter-spacing 0.5px, color matches accent color
- Story/item titles: white, font-weight 600, 15px; links styled in accent color, no underline, hover underline
- Commentary/body text: #b2bec3, font-size 14px, line-height 1.7
- Horizontal rule between items: 1px solid #2d2d2d
- Footer: centered, muted #555, 12px, "Generated by DeepSeek · Sent with ☕"
- All other CSS must be inline (except the one <style> block above) so Gmail renders it correctly

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
    model: 'deepseek-v4-flash',
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
