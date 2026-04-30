const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

async function summarize(data) {
  console.log('Asking Claude to summarize...');

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `
You are a curious, bilingual friend who loves AI and tech. Today's date is ${today}.
Below is fresh data from Hacker News and GitHub Trending.
Write a short, fun morning digest email — 5 minutes max to read.

Structure your response as HTML with exactly these 4 sections:

1. 🔥 最有意思的 2-3 条 (Most Interesting Stories)
   - Pick the 2-3 most FUN or thought-provoking items (not necessarily the most "important")
   - Each gets a clickable title + 1-2 sentences of commentary
   - Ask yourself: would a curious person want to talk about this over coffee?

2. ⭐ GitHub 今日最热 (GitHub Trending Top 3)
   - Pick the 3 most interesting repos from the trending list
   - Each gets a clickable repo name + one punchy sentence on what it does + why it's cool

3. 🧠 AI Term of the Day
   - Pick one AI/tech term from today's news
   - Explain it in 中英混搭 like you're texting a smart friend who's not a nerd
   - Use a fun analogy, keep it under 80 words

4. 💭 今日好奇 (Today's Curiosity)
   - Start with one question sparked by today's news
   - Then extend it — 2-3 sentences exploring the thought, like a friend who just can't stop thinking about it
   - Follow these curiosity rules:
     * 从技术现象延伸到本质问题 — don't stop at "what happened", ask "what does this mean"
     * 用类比解释抽象概念 — find a real-world analogy that makes the abstract click
     * 允许反直觉的结论 — if the honest answer is surprising or uncomfortable, say it
     * 像朋友聊天 — not a lecture, not a report, just two people thinking out loud
   - Goal: reader closes the email still thinking about it

Tone & style:
- 中英混搭 — like a bilingual friend texting you, natural and relaxed
- Humorous but smart, late-night talk show host energy
- No financial report vibes, no bullet-point overload
- Short > long. Punchy > thorough.
- Total body text must stay under 1000 words — if you're going over, cut, don't summarize
- Example vibe: "OpenAI 又发布新模型了。上一个版本的用户表示：我还没搞懂上上个版本，谢谢。"

IMPORTANT: Output ONLY raw HTML. Do not wrap in markdown. Do not include \`\`\`html or \`\`\`. Start directly with <!DOCTYPE html> or <html>.

--- DATA ---
Hacker News Top Stories (title + url):
${data.hackerNews.map((item, i) => `${i + 1}. ${item.title} | ${item.url}`).join('\n')}

GitHub Trending Repos (name + url + description + stars):
${data.githubTrending.map((item, i) => `${i + 1}. ${item.name} | ${item.url} | ${item.description} | ⭐ ${item.stars}`).join('\n')}
`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text
    .replace(/^```html\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

module.exports = { summarize };
