const test = require('node:test');
const assert = require('node:assert/strict');

const { hasRedditOAuthConfig, redditUserAgent, parseAnthropicNews } = require('../src/scraper');

test('Anthropic selects recent dated news instead of an old pinned article', () => {
  const html = ['2026-07-24', '2026-09-03', '2026-09-05', '2026-09-04'].map((date, index) =>
    `<a href="/news/story-${index}"><span>Product</span><time datetime="${date}">${date}</time><h4>Claude announcement number ${index}</h4><p>Announcement summary ${index}</p></a>`).join('');
  const items = parseAnthropicNews(html);
  assert.deepEqual(items.map(item => item.pubDate), ['2026-09-05', '2026-09-04', '2026-09-03']);
  assert.equal(items[0].title, 'Claude announcement number 2');
  assert.equal(items[0].summary, 'Announcement summary 2');
});

test('detects complete Reddit OAuth config', () => {
  assert.equal(hasRedditOAuthConfig({
    REDDIT_CLIENT_ID: 'client-id',
    REDDIT_CLIENT_SECRET: 'client-secret',
  }), true);
});

test('does not enable Reddit OAuth with partial config', () => {
  assert.equal(hasRedditOAuthConfig({ REDDIT_CLIENT_ID: 'client-id' }), false);
  assert.equal(hasRedditOAuthConfig({ REDDIT_CLIENT_SECRET: 'client-secret' }), false);
  assert.equal(hasRedditOAuthConfig({}), false);
});

test('uses configured Reddit user agent when present', () => {
  assert.equal(
    redditUserAgent({ REDDIT_USER_AGENT: 'morning-caoiffee test agent' }),
    'morning-caoiffee test agent'
  );
});

test('falls back to a project-specific Reddit user agent', () => {
  assert.equal(redditUserAgent({}), 'morning-caoiffee/1.0 by fin77n-ai');
});
