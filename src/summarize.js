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
   - Pick the 2-3 most FUN or thought-provoking items from Hacker News (not necessarily the most "important")
   - Each gets a clickable title + 1-2 sentences of commentary
   - Ask yourself: would a curious person want to talk about this over coffee?

2. ⭐ GitHub 今日最热 (GitHub Trending Top 3)
   - Pick the 3 most interesting repos from the trending list
   - Each gets a clickable repo name + one punchy sentence on what it does + why it's cool

3. 🤖 AI 圈在聊什么 (AI Community Buzz)
   - Pick 2-3 most interesting posts from Reddit AI communities (r/MachineLearning, r/LocalLLaMA, r/artificial)
   - Also include 1 highlight from the AI blogs (Simon Willison or The Batch) if it's interesting
   - Each gets a clickable title + 1 sentence on why the community is excited about it
   - Tone: like a friend who's been lurking on the AI forums and found the spicy discussions

4. 🧠 AI Term of the Day
   - Pick one AI/tech term from today's news or community buzz
   - Explain it in 中英混搭 like you're texting a smart friend who's not a nerd
   - Use a fun analogy, keep it under 80 words

5. 💭 今日好奇 (Today's Curiosity)
   - Start with one question sparked by today's news
   - Then extend it — 2-3 sentences exploring the thought, like a friend who just can't stop thinking about it
   - Follow these curiosity rules:
     * 从技术现象延伸到本质问题 — don't stop at "what happened", ask "what does this mean"
     * 用类比解释抽象概念 — find a real-world analogy that makes the abstract click
     * 允许反直觉的结论 — if the honest answer is surprising or uncomfortable, say it
     * 像朋友聊天 — not a lecture, not a report, just two people thinking out loud
   - Goal: reader closes the email still thinking about it

6. 🎙 访谈速读 (Podcast Spotlight)
   - Pick the most interesting recent episode from the podcasts list below
   - Write 3 sentences: who's the guest, what's the big idea, why it matters
   - Then pick 1-2 terms from the episode that a non-technical listener might not know
   - For each term: explain it in 中英混搭 under 50 words, use a fun real-world analogy
   - Tone: like a friend who just finished listening on the commute and is excitedly telling you about it
   - If no new episodes, skip this section entirely

Tone & style:
- 中英混搭 — like a bilingual friend texting you, natural and relaxed
- Humorous but smart, late-night talk show host energy
- No financial report vibes, no bullet-point overload
- Short > long. Punchy > thorough.
- Total body text must stay under 1400 words — if you're going over, cut, don't summarize
- Example vibe: "OpenAI 又发布新模型了。上一个版本的用户表示：我还没搞懂上上个版本，谢谢。"

IMPORTANT: Output ONLY raw HTML. Do not wrap in markdown. Do not include \`\`\`html or \`\`\`. Start directly with <!DOCTYPE html> or <html>.

--- DATA ---
Hacker News Top Stories (title + url):
${data.hackerNews.map((item, i) => `${i + 1}. ${item.title} | ${item.url}`).join('\n')}

GitHub Trending Repos (name + url + description + stars):
${data.githubTrending.map((item, i) => `${i + 1}. ${item.name} | ${item.url} | ${item.description} | ⭐ ${item.stars}`).join('\n')}

Reddit AI Community Posts (subreddit + title + url + upvotes + comments):
${redditSection}

AI Thought-Leader Blog Posts:
${aiBlogsSection}

Latest Podcast Episodes:
${podcastSection}
`;

  const completion = await client.chat.completions.create({
    model: 'deepseek-chat',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  return completion.choices[0].message.content
    .replace(/^```html\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

module.exports = { summarize };
