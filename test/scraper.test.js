const test = require('node:test');
const assert = require('node:assert/strict');

const { hasRedditOAuthConfig, redditUserAgent } = require('../src/scraper');

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
