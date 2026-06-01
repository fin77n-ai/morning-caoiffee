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

  const dataToolsSection = data.dataTools && data.dataTools.length > 0
    ? data.dataTools.map((b, i) => `${i + 1}. [${b.source}] ${b.title} | ${b.link} | ${b.summary}`).join('\n')
    : 'No data-tool updates today.';

  const prompt = `
You are a curious, bilingual friend who loves the whole AI ecosystem. Today is ${today}.
Below is fresh data from Hacker News, GitHub Trending, Reddit AI communities, AI lab blogs, research/product blogs, podcasts, and selected data-tooling updates.
Write a short, fun morning digest — 5 minutes max to read.

=========================
READER CONTEXT (very important)
=========================
The reader wants a broader view of AI, not a RAG-only digest.
Prioritize major AI developments across frontier models, open-source models, agents, multimodal AI, coding tools, evals/safety, product launches, research ideas, developer tooling, and notable community debates.
RAG, vector search, embeddings, SQL, and data tooling are still welcome when genuinely important, but do not force every story through a RAG lens.
If a headline is about model capability, agents, product strategy, safety, creative tools, or open-source AI, explain it on its own terms.

=========================
OUTPUT FORMAT (STRICT — read carefully)
=========================
Output ONLY an HTML fragment (NO <!DOCTYPE>, NO <html>, NO <head>, NO <body>, NO <style> tags).
The fragment will be injected into a dark-themed email template that already handles styling.
Use the EXACT inline styles shown in the templates below for every element — this is critical for email-client dark mode compatibility.
Output the sections below in this exact order. Section 7 is optional and should be skipped entirely if there are no podcast episodes. Each section is a <div>.

----- SECTION 0: Night City signal strip -----
<div style="margin:0 0 28px 0;padding:10px 12px;background-color:rgba(5,8,22,.62);border:1px solid #263B59;border-left:3px solid #F472B6;border-radius:6px;">
  <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;color:#67E8F9;letter-spacing:.08em;line-height:1.6;">╔═ NEON ROUTE 77 ═════════ AI/AGENTS/MODELS ═╗</div>
  <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;color:#F9A8D4;letter-spacing:.08em;line-height:1.6;">╚═ STATUS: caffeinated · noise reduced · vibe online ═╝</div>
  <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;color:#A7F3D0;letter-spacing:.08em;line-height:1.6;">district scan: downtown / market alley / cloud tower / backstreet lab</div>
</div>

----- SECTION 1: Today's three signals -----
<div style="margin-bottom:34px;">
  <div style="font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#F0FD4F;padding-bottom:10px;margin-bottom:14px;border-bottom:1px solid #263B59;">今日三件事</div>
  <div style="background-color:rgba(16,23,43,.78);border:1px solid #445A22;border-left:3px solid #F0FD4F;border-radius:6px;padding:16px 18px;box-shadow:0 0 18px rgba(240,253,79,.13);">
    <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;letter-spacing:.12em;color:#F0FD4F;margin-bottom:10px;">[ INTEL BURST ]  ▮▮▮▯▯  ENCRYPTED MORNING SIGNAL</div>
    <p style="font-size:14px;color:#E2E8F0;line-height:1.65;margin:0 0 8px 0;"><strong style="color:#F0FD4F;">01</strong> 一句话总结今天最重要的 AI 信号</p>
    <p style="font-size:14px;color:#E2E8F0;line-height:1.65;margin:0 0 8px 0;"><strong style="color:#F0FD4F;">02</strong> 一句话总结今天第二个 AI 信号</p>
    <p style="font-size:14px;color:#E2E8F0;line-height:1.65;margin:0;"><strong style="color:#F0FD4F;">03</strong> 一句话总结今天第三个 AI 信号</p>
  </div>
</div>

----- SECTION 2: Top stories -----
<div style="margin-bottom:36px;">
  <div style="font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#22D3EE;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid #263B59;">最有意思的</div>
  <!-- repeat the card below 2-3 times -->
  <div class="card" style="background-color:rgba(16,23,43,.80);border:1px solid #1C5D75;border-left:3px solid #22D3EE;border-radius:6px;padding:16px 18px;margin-bottom:12px;box-shadow:0 0 18px rgba(34,211,238,.12);">
    <div style="font-size:10px;color:#22D3EE;line-height:1;margin-bottom:8px;">◆◆◇  SIGNAL 01 · CLOUD TOWER</div>
    <div style="font-size:11px;color:#67E8F9;font-weight:800;letter-spacing:.06em;margin-bottom:8px;">SOURCE / CATEGORY / SIGNAL LEVEL</div>
    <h3 style="font-size:15px;font-weight:700;margin:0 0 8px 0;line-height:1.45;"><a href="LINK" style="color:#F8FAFC;text-decoration:none;">中文标题</a></h3>
    <p style="font-size:13px;color:#CBD5E1;line-height:1.66;margin:0;">1-2 句中英混搭点评</p>
  </div>
</div>

----- SECTION 3: GitHub trending -----
Same structure as Section 2, title "GitHub 今日最热", 2-3 repos. Use green accent: title color #4ADE80, border-left #22C55E, border #1E6840, meta color #86EFAC, and tiny label like "▰▰▱  DEV GRID · BACKSTREET WORKSHOP".

----- SECTION 4: AI lab + community buzz -----
Same structure as Section 2, title "AI 圈在聊什么", 2-3 items (Reddit + AI blog/lab highlights). Use pink accent: title color #F472B6, border-left #F472B6, border #6D2458, meta color #F9A8D4, and tiny label like "◇◇◆  STREET CHATTER · MARKET ALLEY".

----- SECTION 5: Signal Decode (PURPLE accent — broad AI concept) -----
<div style="margin-bottom:36px;">
  <div style="font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#C084FC;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid #263B59;">信号解码</div>
  <div class="term-card" style="background-color:rgba(16,23,43,.80);border:1px solid #4C1D95;border-left:3px solid #A855F7;border-radius:6px;padding:18px 20px;box-shadow:0 0 18px rgba(168,85,247,.13);">
    <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;letter-spacing:.12em;color:#C4B5FD;margin-bottom:10px;">[ DECODE PATCH ] not studying, just intercepting concepts</div>
    <h2 style="font-size:15px;font-weight:800;color:#C4B5FD;margin:0 0 10px 0;">术语 (Term)</h2>
    <p style="font-size:13px;color:#CBD5E1;line-height:1.7;margin:0 0 10px 0;">中英混搭解释 + 一个生动比喻 (under 80 words)</p>
    <pre style="background-color:#050816;border:1px solid #22D3EE;border-radius:4px;padding:10px 12px;margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:12px;color:#A7F3D0;overflow-x:auto;line-height:1.5;">一行代码、prompt、公式或判断准则</pre>
  </div>
</div>

⚠️ Term should come from broad AI: agents, tool use, reasoning models, multimodality, context windows, evals, alignment, distillation, quantization, MoE, RLHF/RLAIF, synthetic data, model routing, inference latency, open weights, MCP, coding agents, or RAG/data concepts when they are timely. Never repeat yesterday's term.

----- SECTION 6: Today's curiosity (YELLOW accent — broad AI question) -----
<div style="margin-bottom:36px;">
  <div style="font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#F0FD4F;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid #263B59;">今日好奇</div>
  <div class="curiosity-card" style="background-color:rgba(16,23,43,.80);border:1px solid #665A16;border-left:3px solid #F0FD4F;border-radius:6px;padding:18px 20px;box-shadow:0 0 18px rgba(240,253,79,.12);">
    <div style="font-size:10px;color:#F0FD4F;line-height:1;margin-bottom:8px;">▌▌▌ OPEN QUESTION TERMINAL</div>
    <div class="question" style="font-size:15px;font-weight:800;color:#FCD34D;margin-bottom:10px;line-height:1.4;">一个由今天新闻引发的问题？(prefer questions about AI capability, products, agents, research, safety, or developer workflows)</div>
    <p style="font-size:13px;color:#CBD5E1;line-height:1.7;margin:0;">2-3 句延伸思考，像一个朋友停不下来在想这件事</p>
  </div>
</div>

----- SECTION 7: Podcast spotlight (TEAL accent) — skip entirely if no episodes -----
<div style="margin-bottom:0;">
  <div style="font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#2DD4BF;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid #263B59;">访谈速读</div>
  <div class="podcast-card" style="background-color:rgba(16,23,43,.80);border:1px solid #145E58;border-left:3px solid #2DD4BF;border-radius:6px;padding:16px 18px;box-shadow:0 0 18px rgba(45,212,191,.12);">
    <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:10px;letter-spacing:.12em;color:#5EEAD4;margin-bottom:10px;">[ AUDIO RELAY ]  long-form signal</div>
    <h3 style="font-size:15px;font-weight:700;color:#6EE7B7;margin:0 0 8px 0;"><a href="LINK" style="color:#6EE7B7;text-decoration:none;">播客 · 集名</a></h3>
    <p style="font-size:13px;color:#CBD5E1;line-height:1.68;margin:0;">3 句话：嘉宾是谁、核心观点、为什么有意思</p>
  </div>
</div>

=========================
TONE & RULES
=========================
- 中英混搭, humorous but smart, late-night talk show energy.
- Short > long. Punchy > thorough.
- Total under 1400 words.
- Example vibe: "OpenAI 又发布新模型了。上一个版本的用户表示：我还没搞懂上上个版本，谢谢。"
- Output ONLY the HTML fragment. NO markdown fences, NO \`\`\`html, NO commentary before/after.
- ⚠️ Do not output <!DOCTYPE>, <html>, <head>, <body>, or <style> tags. Start directly with the first <div>.

=========================
--- DATA ---
=========================
Hacker News Top Stories:
${data.hackerNews.map((item, i) => `${i + 1}. ${item.title} | ${item.url}`).join('\n')}

GitHub Trending Repos:
${data.githubTrending.map((item, i) => `${i + 1}. ${item.name} | ${item.url} | ${item.description} | ⭐ ${item.stars}`).join('\n')}

Reddit AI Community Posts:
${redditSection}

AI Thought-Leader Blog Posts:
${aiBlogsSection}

Data-Tooling Updates (DuckDB / Chroma / SQLite — use when relevant, but do not let these dominate the digest):
${dataToolsSection}

Latest Podcast Episodes:
${podcastSection}
`;

  const completion = await client.chat.completions.create({
    model: 'deepseek-v4-flash',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  return completion.choices[0].message.content
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim();
}

module.exports = { summarize };
