require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const OpenAI = require('openai');
const { scrapeAll } = require('../src/scraper');
const { optimizeContent } = require('../src/optimizeContent');
const { loadRecentKeys } = require('../src/sentHistory');
const { loadStoryHistory } = require('../src/storyHistory');
const { curateDigest } = require('../src/curateDigest');
const { extractArticle } = require('../src/extractArticle');

function buildCompletionOptions(prompt) {
  return {
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
    thinking: { type: 'disabled' }, max_tokens: 2200,
    messages: [{ role: 'user', content: prompt }],
  };
}

async function generateTelegramEdition(options = {}) {
  const now = options.now || new Date();
  const rawData = options.rawData || await scrapeAll();
  const data = optimizeContent(rawData); // Seen URLs remain eligible for real updates.
  const usage = [];
  let client;
  const complete = options.complete || (async (prompt, stage) => {
    client ||= new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com', timeout: 90000, maxRetries: 1 });
    const started = Date.now();
    const response = await client.chat.completions.create({ ...buildCompletionOptions(prompt), response_format: { type: 'json_object' } });
    usage.push({ stage, elapsedMs: Date.now() - started, ...response.usage });
    if (response.choices[0]?.finish_reason !== 'stop') throw new Error(`${stage}: incomplete model response`);
    return JSON.parse(response.choices[0].message.content);
  });
  const edition = await curateDigest(data, {
    complete, now, extract: options.extract,
    history: options.history || loadStoryHistory(undefined, now),
    recentKeys: options.recentKeys || loadRecentKeys(),
  });
  console.log(`Source health: ${data.sourceHealth.filter(source => source.status === 'ok').length}/${data.sourceHealth.length} ok`);
  console.log(`V2: ${edition.candidates.length} candidates -> ${edition.selection.length} events -> ${edition.stories.length} stories (${edition.text.length} chars)`);
  console.log(`Model usage: ${JSON.stringify(usage)}`);
  return { ...edition, rawData, usage };
}

async function generateTelegramDigest(options) {
  return (await generateTelegramEdition(options)).text;
}

function savePreview(edition, directory) {
  fs.mkdirSync(directory, { recursive: true });
  // Public preview contains only the final digest and its short evidence snippets.
  fs.writeFileSync(path.join(directory, 'digest.txt'), edition.text + '\n');
  fs.writeFileSync(path.join(directory, 'edition.json'), JSON.stringify({
    version: edition.version, generatedAt: edition.generatedAt, stories: edition.stories,
    previewMode: edition.previewMode || 'normal',
    usage: edition.usage, sourceHealth: edition.sourceHealth,
    articleReadings: edition.articles.map(item => ({ id: item.id, url: item.url,
      status: item.article.status, excerptLength: item.article.text.length })),
  }, null, 2) + '\n');
  const input = { sourceHealth: edition.sourceHealth };
  for (const item of edition.candidates) {
    (input[item.group] ||= []).push({ title: item.title, url: item.url, link: item.url,
      summary: item.summary, pubDate: item.pubDate, author: item.source });
  }
  fs.writeFileSync(path.join(directory, 'candidates.json'), JSON.stringify(input, null, 2) + '\n');
}

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const outputIndex = args.indexOf('--output');
  if ((inputIndex >= 0 && !args[inputIndex + 1]) || (outputIndex >= 0 && !args[outputIndex + 1])) throw new Error('Missing preview argument');
  const input = inputIndex >= 0 ? JSON.parse(fs.readFileSync(args[inputIndex + 1], 'utf8')) : undefined;
  const rawData = input?.rawData || input;
  const directory = outputIndex >= 0 ? args[outputIndex + 1] : path.join('work', 'telegram-preview');
  const cached = new Map((input?.articles || []).map(item => [item.url, item.article]));
  const freshReader = args.includes('--fresh-reader');
  const edition = await generateTelegramEdition({ rawData,
    ...(freshReader ? { history: [], recentKeys: new Set() } : {}),
    extract: item => cached.has(item.url) ? cached.get(item.url) : extractArticle(item) });
  edition.previewMode = freshReader ? 'fresh-reader' : 'normal';
  savePreview(edition, directory);
  // Local replay snapshot is deliberately separate from the uploadable preview.
  const snapshotDirectory = path.join('work', 'digest-snapshots');
  fs.mkdirSync(snapshotDirectory, { recursive: true });
  fs.writeFileSync(path.join(snapshotDirectory, `${edition.generatedAt.replace(/[:.]/g, '-')}.json`), JSON.stringify(edition, null, 2));
  console.log(edition.text);
  console.log(`Preview saved to ${directory}; no message sent and no history updated.`);
  if (freshReader) console.log('Fresh-reader sample: existing history was ignored for this preview only.');
}

module.exports = { generateTelegramDigest, generateTelegramEdition, buildCompletionOptions, savePreview };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
