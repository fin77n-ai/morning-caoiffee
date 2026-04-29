const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

async function summarize(data) {
  console.log('Asking Claude to summarize...');

  const prompt = `
You are an AI trend analyst. Below is today's raw data scraped from Hacker News and Hugging Face Blog.
Summarize this into a clean, engaging morning digest email focused on AI trends.

Structure your response as HTML with these sections:
1. 🔥 Top AI Stories (3-5 most important items, each with a 1-2 sentence commentary AND a clickable hyperlink on the title)
2. 🤖 New Models & Research (from Hugging Face, each with commentary AND a clickable hyperlink — make sure every item has content, no blank cards)
3. ☕ Quick Takes (bullet points for other notable items, with hyperlinks)
4. 🧠 AI Term of the Day (pick one AI/tech term, explain it in a fun, simple way in 中英混搭 — like explaining to a smart friend who's not a nerd)

Rules for section 2 (🤖 New Models & Research):
- Every card MUST have a title, a hyperlink, AND at least 1-2 sentences of commentary
- Do NOT leave any card blank or with just a title
- If you don't know much about a paper, make a witty educated guess based on the title

Tone & Language style:
- Write in a fun mix of English and Chinese (中英混搭) — like a bilingual friend texting you
- Be humorous but smart, like a late-night talk show host who actually knows AI
- Occasional sarcasm about tech hype is welcome
- NOT too serious, NOT financial report style
- Example vibe: "GPT-5 出来了，推理能力又强了。上一个版本的用户表示：我还没搞懂GPT-4，谢谢。"

IMPORTANT: Output ONLY raw HTML. Do not wrap it in markdown code blocks. Do not include \`\`\`html or \`\`\`. Start your response directly with <!DOCTYPE html> or <html>.

--- DATA ---
Hacker News Top Stories (title + url):
${data.hackerNews.map((item, i) => `${i + 1}. ${item.title} | ${item.url}`).join('\n')}

Hugging Face Blog (title + url):
${data.huggingFace.map((item, i) => `${i + 1}. ${item.title} | ${item.url}`).join('\n')}
`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  
// 在报错的变量前面，把它打印出来看看究竟是个什么东西
console.log("Debug - The value before replace is:", theVariableYouAreTryingToReplace);
  return message.content[0].text
    .replace(/^```html\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

module.exports = { summarize };
