const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_REPO = 'https://github.com/fin77n-ai/morning-caoiffee';
const HISTORY_PATH = path.join(ROOT, 'data', 'topic-deliveries.json');

function localDay(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function weekKey(day) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

function loadHistory(file = HISTORY_PATH) {
  let history;
  try {
    history = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return { deliveries: [] };
    throw new Error('Cannot read topic delivery history; refusing to risk duplicate delivery.');
  }
  if (!history || !Array.isArray(history.deliveries) || history.deliveries.some(entry =>
    !entry || typeof entry.topicId !== 'string' || typeof entry.chapterId !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(entry.day || '')
    || !/^\d{4}-\d{2}-\d{2}$/.test(entry.week || ''))) {
    throw new Error('Invalid topic delivery history.');
  }
  return history;
}

function validateConfig(config, root = ROOT) {
  if (!config || !Array.isArray(config.topics)) throw new Error('Missing topics configuration.');
  localDay(new Date(), config.timeZone || 'Asia/Shanghai');
  const ids = new Set();
  for (const topic of config.topics) {
    if (!/^[a-z0-9-]+$/.test(topic.id || '') || ids.has(topic.id)
      || !/^\d{4}-(0[1-9]|1[0-2])$/.test(topic.month || '') || !topic.title || !topic.outcome
      || !Array.isArray(topic.chapters) || topic.chapters.length !== 4) {
      throw new Error('Each topic needs a unique ID, release month, title, outcome and four chapters.');
    }
    ids.add(topic.id);
    const chapters = new Set();
    for (const chapter of topic.chapters) {
      if (!/^[a-z0-9-]+$/.test(chapter.id || '') || chapters.has(chapter.id)
        || !/^[a-z0-9-]+\.md$/.test(chapter.file || '')
        || !chapter.title || !chapter.teaser || !chapter.question) {
        throw new Error(`Invalid chapter in ${topic.id}.`);
      }
      chapters.add(chapter.id);
      if (!fs.existsSync(path.join(root, 'docs', 'topics', topic.id, chapter.file))) {
        throw new Error(`Missing chapter file: ${topic.id}/${chapter.file}`);
      }
    }
    if (!fs.existsSync(path.join(root, 'docs', 'topics', topic.id, 'README.md'))) {
      throw new Error(`Missing topic index: ${topic.id}`);
    }
  }
}

function selectChapter(config, history, now = new Date()) {
  const day = localDay(now, config.timeZone || 'Asia/Shanghai');
  const week = weekKey(day);
  if (history.deliveries.some(entry => entry.week === week)) return null;
  // Finish an older topic before starting the next one, even across a month boundary.
  const topics = config.topics.filter(topic => topic.month <= day.slice(0, 7))
    .sort((a, b) => a.month.localeCompare(b.month));
  for (const topic of topics) {
    const index = topic.chapters.findIndex(chapter => !history.deliveries.some(entry =>
      entry.topicId === topic.id && entry.chapterId === chapter.id));
    if (index !== -1) return { topic, chapter: topic.chapters[index], index, day, week };
  }
  return null;
}

function buildTopicMessage(selection, repo = DEFAULT_REPO) {
  const { topic, chapter, index } = selection;
  const base = `${repo.replace(/\/$/, '')}/blob/main/docs/topics/${topic.id}`;
  const previous = index > 0 ? `\n上一篇：${base}/${topic.chapters[index - 1].file}` : '';
  const text = `☕ Morning cAoIffee · 月度专题\n\n${topic.title}\n第 ${index + 1}/4 篇 · ${chapter.title}\n\n${chapter.teaser}\n\n这次带着一个问题读：${chapter.question}\n\n阅读全文：${base}/${chapter.file}\n专题目录：${base}/README.md${previous}\n\n有空再读，四篇都在目录里，不用补打卡。`;
  if (text.length > 3500) throw new Error('Topic notification exceeds one Telegram message.');
  return text;
}

function saveHistory(history, file = HISTORY_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

async function deliverTopic({ config, history, now = new Date(), send, save = saveHistory, repo }) {
  const selection = selectChapter(config, history, now);
  if (!selection) return null;
  const message = buildTopicMessage(selection, repo);
  await send(message);
  const updated = { deliveries: [...history.deliveries, {
    topicId: selection.topic.id, chapterId: selection.chapter.id,
    day: selection.day, week: selection.week,
  }] };
  // Never mark a failed Telegram request as delivered.
  save(updated);
  return selection;
}

module.exports = {
  ROOT, HISTORY_PATH, localDay, weekKey, loadHistory, validateConfig,
  selectChapter, buildTopicMessage, saveHistory, deliverTopic,
};
