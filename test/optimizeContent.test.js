const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { optimizeContent, normalize } = require('../src/optimizeContent');
const { loadRecentKeys, recordSentDigest } = require('../src/sentHistory');

const testProfile = {
  version: 'test-profile',
  topics: {
    agents: {
      label: 'agents',
      weight: 2,
      keywords: ['agent', 'agents', 'workflow'],
    },
    data: {
      label: 'data',
      weight: 0.5,
      keywords: ['database', 'sqlite', 'vector'],
    },
  },
  sourceWeights: {
    hackerNews: 1,
    githubTrending: 1,
    reddit: 1,
    aiBlogs: 1,
    podcasts: 1,
  },
  limits: {
    hackerNews: 2,
    githubTrending: 2,
    reddit: 2,
    aiBlogs: 2,
    podcasts: 2,
  },
};

function baseData(overrides = {}) {
  return {
    hackerNews: [],
    githubTrending: [],
    podcasts: [],
    reddit: [],
    aiBlogs: [],
    sourceHealth: [],
    ...overrides,
  };
}

test('ranks stronger topic matches first and applies group limits', () => {
  const optimized = optimizeContent(baseData({
    hackerNews: [
      { title: 'SQLite database maintenance notes', url: 'https://example.com/sqlite' },
      { title: 'Agent workflow launch for developers', url: 'https://example.com/agents' },
      { title: 'Small general web update', url: 'https://example.com/general' },
    ],
  }), testProfile);

  assert.equal(optimized.hackerNews.length, 2);
  assert.equal(optimized.hackerNews[0].title, 'Agent workflow launch for developers');
  assert.equal(optimized.hackerNews[0].category, 'agents');
  assert.equal(optimized.optimization.outputCounts.hackerNews, 2);
});

test('dedupes items by normalized URL before ranking', () => {
  const optimized = optimizeContent(baseData({
    hackerNews: [
      { title: 'Agent workflow launch', url: 'https://example.com/story?utm_source=test' },
      { title: 'Agent workflow launch duplicate', url: 'https://example.com/story' },
      { title: 'Another agent workflow', url: 'https://example.com/other' },
    ],
  }), testProfile);

  assert.deepEqual(
    optimized.hackerNews.map((item) => item.url),
    ['https://example.com/story?utm_source=test', 'https://example.com/other']
  );
});

test('keeps failed source health in optimization metadata', () => {
  const optimized = optimizeContent(baseData({
    sourceHealth: [
      { source: 'Working Source', status: 'ok', count: 1 },
      { source: 'Broken Source', status: 'failed', count: 0, error: 'boom' },
    ],
  }), testProfile);

  assert.equal(optimized.optimization.failedSources, 1);
});

test('blocklist vetoes hard-science items unless AI-exempted', () => {
  const profile = { ...testProfile, blockKeywords: ['quantum'], blockExemptions: ['llm'] };
  const optimized = optimizeContent(baseData({
    hackerNews: [
      { title: 'Quantum entanglement breakthrough confirmed', url: 'https://example.com/q1' },
      { title: 'Quantum tricks for faster LLM agent serving', url: 'https://example.com/q2' },
      { title: 'Agent workflow news roundup', url: 'https://example.com/a1' },
    ],
  }), profile);

  const urls = optimized.hackerNews.map((item) => item.url);
  assert.ok(!urls.includes('https://example.com/q1'));
  assert.ok(urls.includes('https://example.com/q2'));
  assert.equal(optimized.optimization.droppedCounts.blocked, 1);
});

test('keyword matching respects word boundaries', () => {
  const optimized = optimizeContent(baseData({
    aiBlogs: [
      { title: 'The vectorized approach to rendering', link: 'https://example.com/v1' },
      { title: 'Vector database showdown', link: 'https://example.com/v2' },
    ],
  }), testProfile);

  const v1 = optimized.aiBlogs.find((item) => item.link === 'https://example.com/v1');
  const v2 = optimized.aiBlogs.find((item) => item.link === 'https://example.com/v2');
  assert.equal(v1.category, 'generalAI');
  assert.equal(v2.category, 'data');
});

test('requireTopicMatch drops zero-match items from noisy groups', () => {
  const profile = { ...testProfile, requireTopicMatch: ['hackerNews'] };
  const optimized = optimizeContent(baseData({
    hackerNews: [
      { title: 'Agent workflow launch', url: 'https://example.com/a' },
      { title: 'Random cooking blog post', url: 'https://example.com/c' },
    ],
  }), profile);

  assert.deepEqual(optimized.hackerNews.map((item) => item.url), ['https://example.com/a']);
  assert.equal(optimized.optimization.droppedCounts.offTopic, 1);
});

test('cross-source dedup keeps the higher-authority group occurrence', () => {
  const optimized = optimizeContent(baseData({
    aiBlogs: [{ title: 'Agent workflow launch', link: 'https://example.com/big-news' }],
    hackerNews: [
      { title: 'Agent workflow launch on HN', url: 'https://example.com/big-news' },
      { title: 'Agent workflow second story', url: 'https://example.com/second' },
    ],
  }), testProfile);

  assert.equal(optimized.aiBlogs.length, 1);
  assert.deepEqual(optimized.hackerNews.map((item) => item.url), ['https://example.com/second']);
  assert.equal(optimized.optimization.droppedCounts.crossSource, 1);
});

test('excludeKeys drops items already sent on previous days', () => {
  const excludeKeys = new Set([normalize('https://example.com/old-story')]);
  const optimized = optimizeContent(baseData({
    hackerNews: [
      { title: 'Agent old story', url: 'https://example.com/old-story' },
      { title: 'Agent new story', url: 'https://example.com/new-story' },
    ],
  }), testProfile, { excludeKeys });

  assert.deepEqual(optimized.hackerNews.map((item) => item.url), ['https://example.com/new-story']);
  assert.equal(optimized.optimization.droppedCounts.repeated, 1);
});

test('stale blog posts are dropped, fresh ones survive', () => {
  const now = Date.now();
  const optimized = optimizeContent(baseData({
    aiBlogs: [
      { title: 'Agent post ancient', link: 'https://example.com/ancient', pubDate: new Date(now - 30 * 86400000).toISOString() },
      { title: 'Agent post today', link: 'https://example.com/today', pubDate: new Date(now).toISOString() },
    ],
  }), testProfile);

  assert.deepEqual(optimized.aiBlogs.map((item) => item.link), ['https://example.com/today']);
  assert.equal(optimized.optimization.droppedCounts.stale, 1);
});

test('normalize keeps meaningful query params, strips tracking, keeps CJK', () => {
  assert.notEqual(normalize('https://youtube.com/watch?v=abc'), normalize('https://youtube.com/watch?v=def'));
  assert.equal(normalize('https://example.com/a?utm_source=x'), normalize('https://example.com/a'));
  assert.ok(normalize('通义千问发布新模型').length > 0);
});

test('sent history roundtrip records and recalls normalized keys', () => {
  const tmp = path.join(os.tmpdir(), `sent-history-test-${process.pid}.json`);
  fs.rmSync(tmp, { force: true });
  const count = recordSentDigest('看这条 https://example.com/story?utm_source=tg 不错', tmp);
  assert.equal(count, 1);
  const keys = loadRecentKeys(7, tmp);
  assert.ok(keys.has(normalize('https://example.com/story')));
  fs.rmSync(tmp, { force: true });
});
