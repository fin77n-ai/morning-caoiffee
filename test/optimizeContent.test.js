const test = require('node:test');
const assert = require('node:assert/strict');

const { optimizeContent } = require('../src/optimizeContent');

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
    dataTools: 1,
    podcasts: 1,
  },
  limits: {
    hackerNews: 2,
    githubTrending: 2,
    reddit: 2,
    aiBlogs: 2,
    dataTools: 2,
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
    dataTools: [],
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
