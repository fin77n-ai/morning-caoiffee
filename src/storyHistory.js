const fs = require('node:fs');
const path = require('node:path');

const STORY_HISTORY_PATH = path.join(__dirname, '..', 'data', 'story-history.json');
const RETENTION_DAYS = 30;

function validStory(story) {
  return story && typeof story.id === 'string' && typeof story.title === 'string' &&
    Array.isArray(story.facts) && story.facts.every(value => typeof value === 'string') &&
    Array.isArray(story.urls) && story.urls.every(value => typeof value === 'string') &&
    story.contentHashes && typeof story.contentHashes === 'object' && !Array.isArray(story.contentHashes) &&
    Number.isFinite(Date.parse(story.firstSentAt)) && Number.isFinite(Date.parse(story.lastSentAt));
}

function loadStoryHistory(historyPath = STORY_HISTORY_PATH, now = new Date()) {
  try {
    const entries = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    if (!Array.isArray(entries) || !entries.every(validStory)) throw new Error('Invalid story history');
    return entries.filter(story => Date.parse(story.lastSentAt) >= now.getTime() - RETENTION_DAYS * 86400000)
      .sort((a, b) => Date.parse(b.lastSentAt) - Date.parse(a.lastSentAt)).slice(0, 120);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error; // Never silently overwrite damaged memory.
    return [];
  }
}

function recordSentStories(stories, historyPath = STORY_HISTORY_PATH, now = new Date()) {
  const entries = new Map(loadStoryHistory(historyPath, now).map(story => [story.id, story]));
  for (const story of stories) {
    const previous = entries.get(story.id);
    const urls = [...new Set([...(previous?.urls || []), ...story.urls])].slice(-12);
    const hashes = { ...previous?.contentHashes, ...story.contentHashes };
    const entry = {
      id: story.id, title: story.title,
      facts: [...new Set([...(previous?.facts || []), ...story.facts])].slice(-12),
      urls, contentHashes: Object.fromEntries(urls.filter(url => hashes[url]).map(url => [url, hashes[url]])),
      firstSentAt: previous?.firstSentAt || now.toISOString(), lastSentAt: now.toISOString(),
    };
    if (!validStory(entry)) throw new Error('Invalid sent story');
    entries.set(entry.id, entry);
  }
  const result = [...entries.values()].sort((a, b) => Date.parse(b.lastSentAt) - Date.parse(a.lastSentAt)).slice(0, 120);
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  const temporary = `${historyPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(temporary, historyPath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return stories.length;
}

module.exports = { loadStoryHistory, recordSentStories, STORY_HISTORY_PATH };
