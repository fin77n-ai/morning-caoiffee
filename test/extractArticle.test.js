const test = require('node:test');
const assert = require('node:assert/strict');
const { extractArticle, validateUrl, isPublicAddress } = require('../src/extractArticle');

test('Readability extracts actual article text while dropping navigation and scripts', async () => {
  const paragraph = 'Example AI now exports video locally for all users. Model downloads still require an internet connection. ';
  const result = await extractArticle({ url: 'https://example.com/a' }, { fetch: async () => ({
    html: `<html><head><title>Local export</title></head><body><nav>Cookie settings navigation</nav><article><h1>Local export</h1>${Array.from({ length: 5 }, () => `<p>${paragraph}</p>`).join('')}</article><script>throw new Error('must not run')</script></body></html>`,
  }) });
  assert.equal(result.status, 'full');
  assert.match(result.text, /exports video locally/);
  assert.doesNotMatch(result.text, /Cookie settings|must not run/);
});

test('failed extraction keeps only supplied summary and marks evidence as incomplete', async () => {
  const result = await extractArticle({ url: 'https://example.com/a', summary: 'Only this fact is known.' }, { fetch: async () => { throw new Error('timeout'); } });
  assert.equal(result.status, 'summary');
  assert.equal(result.text, 'Only this fact is known.');
  assert.equal(result.readFailures[0].reason, 'timeout');
});

test('GitHub root repositories use the rendered README before the navigation-heavy page', async () => {
  const calls = [];
  const result = await extractArticle({ url: 'https://github.com/example/music', summary: 'Short description.' }, {
    fetch: async (url, options) => {
      calls.push(url);
      assert.equal(options.accept, 'application/vnd.github.html+json');
      return { html: '<article><h1>Music</h1><p>' + 'The new release supports editable song plans and local generation with non-commercial weights. '.repeat(4) + '</p></article>' };
    },
  });
  assert.deepEqual(calls, ['https://api.github.com/repos/example/music/readme']);
  assert.equal(result.status, 'full');
  assert.equal(result.source, 'github-readme');
  assert.match(result.text, /non-commercial weights/);
});

test('a failed README read falls back to the page and preserves the failure reason', async () => {
  const calls = [];
  const result = await extractArticle({ url: 'https://github.com/example/music' }, {
    fetch: async url => {
      calls.push(url);
      if (url.includes('api.github.com')) throw Object.assign(new Error('rate limited'), { response: { status: 403 } });
      return { html: '<article><p>' + 'The new release supports editable song plans and non-commercial local weights. '.repeat(4) + '</p></article>' };
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(result.source, 'page');
  assert.equal(result.readFailures[0].reason, 'http_403');
});

test('unsafe input URLs cannot reach the README or page reader', async () => {
  const result = await extractArticle({ url: 'http://127.0.0.1/private', summary: 'Only supplied evidence.' }, {
    fetch: async () => assert.fail('unsafe URL was fetched'),
  });
  assert.equal(result.status, 'summary');
  assert.equal(result.readFailures[0].reason, 'non_public_address');
});

test('updates beyond the model excerpt still change the full-text hash', async () => {
  const paragraph = 'A sufficiently detailed account of the same product release and its technical limitations. ';
  const extract = update => extractArticle({ title: 'Release notes', url: 'https://example.com/a' }, {
    fetch: async () => ({ html: `<article><h1>Release notes</h1><p>${paragraph.repeat(120)}</p><p>${update}</p><p>${paragraph.repeat(120)}</p></article>` }),
  });
  const before = await extract('The previous usage limit was one hundred requests per day.');
  const after = await extract('The updated usage limit is now two hundred requests per day.');
  assert.equal(before.status, 'full');
  assert.ok(before.text.length <= 12000);
  assert.equal(before.text, after.text);
  assert.notEqual(before.hash, after.hash);
});

test('article requests reject local, metadata, mapped IPv6 and non-web URLs', () => {
  for (const url of ['http://127.0.0.1', 'http://169.254.169.254', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'file:///etc/passwd', 'https://user:secret@example.com']) {
    assert.throws(() => validateUrl(url));
  }
  for (const address of ['10.0.0.1', '192.168.1.1', '::1', '::ffff:127.0.0.1', '169.254.169.254']) assert.equal(isPublicAddress(address), false);
  assert.equal(isPublicAddress('1.1.1.1'), true);
});

test('long RSS cannot hide an update beyond its retained prefix', async () => {
  const prefix = 'An account of the model release and its limitations. '.repeat(650);
  let reads = 0;
  const extract = update => extractArticle({ title: 'Release', url: 'https://example.com/rss', content: `<p>${prefix}${update}</p>` }, {
    fetch: async () => { reads++; return { html: `<article><p>${prefix}${update}</p></article>` }; },
  });
  const before = await extract('Daily limit is 100 requests.');
  const after = await extract('Daily limit is 200 requests.');
  assert.equal(reads, 2);
  assert.equal(before.status, 'full');
  assert.notEqual(before.hash, after.hash);
});

test('a truncated feed remains incomplete evidence when the page is unavailable', async () => {
  const result = await extractArticle({ url: 'https://example.com/rss', content: '<p>' + 'Known release fact. '.repeat(100) + '</p>', contentTruncated: true },
    { fetch: async () => { throw new Error('blocked'); } });
  assert.equal(result.status, 'summary');
  assert.equal(result.source, 'feed');
  assert.equal(result.truncated, true);
  assert.match(result.text, /Known release fact/);
});
