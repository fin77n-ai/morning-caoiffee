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
You are a curious, bilingual friend who loves AI, RAG and data engineering. Today is ${today}.
Below is fresh data from Hacker News, GitHub Trending, Reddit AI communities, AI blogs, podcasts, and the data-tooling world (DuckDB / Chroma / SQLite).
Write a short, fun morning digest — 5 minutes max to read.

=========================
READER CONTEXT (very important)
=========================
The reader is actively learning RAG and data analysis. Daily stack: Python, SQL, SQLite, DuckDB, Pandas, ChromaDB, embeddings.
Prioritize stories that touch RAG, vector search, embeddings, LLM + database tooling, columnar storage, SQL tricks, data pipelines.
If a generic AI headline can be reframed through the lens of "what does this mean for someone building a RAG app?" — do it.

=========================
OUTPUT FORMAT (STRICT — read carefully)
=========================
Output ONLY an HTML fragment (NO <!DOCTYPE>, NO <html>, NO <head>, NO <body>, NO <style> tags).
The fragment will be injected into a dark-themed email template that already handles styling.
Use the EXACT inline styles shown in the templates below for every element — this is critical for email-client dark mode compatibility.
Output 6 sections in this exact order. Each section is a <div>.

----- SECTION 1: Top stories -----
<div style="margin-bottom:36px;">
  <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#06B6D4;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid #1E293B;">🔥 最有意思的</div>
  <!-- repeat the card below 2-3 times -->
  <div class="card" style="background-color:#1E293B;border:1px solid #334155;border-left:3px solid #06B6D4;border-radius:10px;padding:16px 18px;margin-bottom:10px;">
    <h3 style="font-size:14px;font-weight:600;margin:0 0 7px 0;line-height:1.45;"><a href="LINK" style="color:#E2E8F0;text-decoration:none;">中文标题</a></h3>
    <p style="font-size:13px;color:#94A3B8;line-height:1.68;margin:0;">1-2 句中英混搭点评</p>
  </div>
</div>

----- SECTION 2: GitHub trending -----
Same structure as Section 1, title "⭐ GitHub 今日最热", 3 repos.

----- SECTION 3: AI community buzz -----
Same structure as Section 1, title "🤖 AI 圈在聊什么", 2-3 items (Reddit + 1 blog highlight).

----- SECTION 4: AI Term of the Day (PURPLE accent — must focus on RAG / SQL / vector DB / data tooling) -----
<div style="margin-bottom:36px;">
  <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#A78BFA;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid #1E293B;">🧠 AI Term of the Day</div>
  <div class="term-card" style="background-color:#1E293B;border:1px solid #334155;border-left:3px solid #7C3AED;border-radius:10px;padding:18px 20px;">
    <h2 style="font-size:14px;font-weight:700;color:#A78BFA;margin:0 0 10px 0;">术语 (Term)</h2>
    <p style="font-size:13px;color:#94A3B8;line-height:1.7;margin:0 0 10px 0;">中英混搭解释 + 一个生动比喻 (under 80 words)</p>
    <pre style="background-color:#0F172A;border:1px solid #334155;border-radius:6px;padding:10px 12px;margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:12px;color:#67E8F9;overflow-x:auto;line-height:1.5;">一行可运行的代码示例（SQL / DuckDB / Pandas / ChromaDB）</pre>
  </div>
</div>

⚠️ Term MUST come from: chunking strategies, hybrid search, BM25, reranking, query expansion, columnar storage, vector index (HNSW/IVF), cosine similarity, embeddings, OLAP vs OLTP, window functions, CTE, DuckDB-specific feature, SQLite trick, Pandas idiom, ChromaDB API, etc. Never repeat yesterday's term.

----- SECTION 5: Today's curiosity (AMBER accent — connect to RAG / data practice) -----
<div style="margin-bottom:36px;">
  <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#FCD34D;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid #1E293B;">💭 今日好奇</div>
  <div class="curiosity-card" style="background-color:#1E293B;border:1px solid #334155;border-left:3px solid #F59E0B;border-radius:10px;padding:18px 20px;">
    <div class="question" style="font-size:15px;font-weight:700;color:#FCD34D;margin-bottom:10px;line-height:1.4;">一个由今天新闻引发的问题？(prefer questions that connect to RAG / SQL / data work)</div>
    <p style="font-size:13px;color:#94A3B8;line-height:1.7;margin:0;">2-3 句延伸思考，像一个朋友停不下来在想这件事</p>
  </div>
</div>

----- SECTION 6: Podcast spotlight (GREEN accent) — skip entirely if no episodes -----
<div style="margin-bottom:0;">
  <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6EE7B7;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid #1E293B;">🎙 访谈速读</div>
  <div class="podcast-card" style="background-color:#1E293B;border:1px solid #334155;border-left:3px solid #10B981;border-radius:10px;padding:18px 20px;">
    <h3 style="font-size:14px;font-weight:600;color:#6EE7B7;margin:0 0 8px 0;"><a href="LINK" style="color:#6EE7B7;text-decoration:none;">播客 · 集名</a></h3>
    <p style="font-size:13px;color:#94A3B8;line-height:1.68;margin:0;">3 句话：嘉宾是谁、核心观点、为什么有意思</p>
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

Data-Tooling Updates (DuckDB / Chroma / SQLite — prioritize these for the AI Term and curiosity sections):
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
