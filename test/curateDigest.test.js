const test = require('node:test');
const assert = require('node:assert/strict');
const { curateDigest, prepareCandidates } = require('../src/curateDigest');
const { generateTelegramEdition, savePreview } = require('../scripts/telegram-digest');
const { extractArticle } = require('../src/extractArticle');
const { normalize } = require('../src/optimizeContent');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const now = new Date('2026-09-05T00:00:00Z');
const raw = {
  aiBlogs: [{ title: 'Example AI opens local video export', link: 'https://example.com/video', summary: 'Local export is now available to all users.', pubDate: now.toISOString() }],
  sourceHealth: [{ source: 'Example', status: 'ok', count: 1 }],
};
const text = 'Local export is now available to all users. An internet connection is still needed to download models.';
const extract = async () => ({ text, status: 'full', hash: 'new-hash' });
function draft(id, extra = {}) {
  return { stories: [{ slot: 'lead', event: `Release ${id}`, candidateIds: [id], historyId: null, novelty: 'new', change: '',
    headline: '视频可以在本地导出了', body: '这次开放的是本地导出；下载模型仍需要联网。',
    facts: [{ text: '本地导出向所有用户开放', sourceId: id, quote: 'Local export is now available to all users.' }], ...extra }] };
}

test('healthy source lists with unreadable articles report limited evidence, not no news', async () => {
  const id = prepareCandidates(raw)[0].id;
  let calls = 0;
  const edition = await curateDigest(raw, { now,
    extract: async () => ({ text: '', status: 'unavailable', hash: '' }),
    complete: async () => { calls++; return { groups: [{ ids: [id], reason: 'Verify this story' }] }; },
  });
  assert.equal(calls, 1);
  assert.match(edition.text, /可核实的信息有限/);
  assert.doesNotMatch(edition.text, /没有值得展开的新变化/);
});

test('unknown selection IDs never enter extraction or drafting', async () => {
  let calls = 0;
  const edition = await curateDigest(raw, { now, extract: async () => assert.fail('unknown ID fetched'), complete: async () => {
    calls++; return { groups: [{ ids: ['unknown'], reason: 'Invalid' }] };
  } });
  assert.equal(calls, 1);
  assert.equal(edition.stories.length, 0);
  assert.equal(edition.selectionOmissions, 1);
  assert.match(edition.text, /可核实的信息有限/);
});

test('known selection IDs survive unknown and repeated IDs without duplicate fetches', async () => {
  const id = prepareCandidates(raw)[0].id;
  let reads = 0;
  const edition = await curateDigest(raw, { now,
    extract: async () => { reads++; return extract(); },
    complete: async (_prompt, stage) => stage === 'select' ? { groups: [{ ids: [id, 'unknown', id], reason: 'test' }] } : draft(id),
  });
  assert.equal(reads, 1);
  assert.equal(edition.selectionOmissions, 2);
  assert.equal(edition.stories.length, 1);
});

test('selection source budget is capped even when six events have multiple sources', async () => {
  const data = { aiBlogs: Array.from({ length: 8 }, (_, index) => ({
    title: `Example AI update ${index}`, link: `https://example.com/${index}`, summary: text,
  })) };
  const ids = prepareCandidates(data).map(item => item.id);
  const reads = [];
  const edition = await curateDigest(data, { now,
    complete: async (_prompt, stage) => stage === 'select' ? {
      groups: [ids.slice(0, 3), ids.slice(3, 6), ids.slice(6)].map(group => ({ ids: group, reason: 'Related sources' })),
    } : { stories: [] },
    extract: async item => { reads.push(item.id); return extract(); },
  });
  assert.deepEqual(reads, ids.slice(0, 6));
  assert.equal(edition.selection.length, 2);
});

test('legacy-only URLs do not repeat on migration without old facts to verify an update', async () => {
  const edition = await curateDigest(raw, { now, history: [],
    recentKeys: new Set([normalize(raw.aiBlogs[0].link)]),
    complete: async () => assert.fail('legacy-only repeat entered selection'),
    extract: async () => assert.fail('legacy-only repeat entered extraction'),
  });
  assert.equal(edition.stories.length, 0);
});

test('only the final fact-check pass is rendered and retained as event memory', async () => {
  const id = prepareCandidates(raw)[0].id;
  const stages = [];
  const edition = await curateDigest(raw, { now, extract, complete: async (prompt, stage) => {
    stages.push(stage);
    if (stage === 'select') return { groups: [{ ids: [id], reason: 'test' }] };
    if (stage === 'write') return draft(id, { body: '适用于所有模型的无条件胜利。',
      facts: [{ text: '适用于所有模型的无条件胜利。', sourceId: id, quote: 'Local export is now available to all users.' }] });
    assert.match(prompt, /适用于所有模型的无条件胜利/);
    return draft(id, { body: '适用于所有模型的无条件胜利。' });
  } });
  assert.deepEqual(stages, ['select', 'write', 'review']);
  assert.match(edition.text, /本地导出向所有用户开放/);
  assert.doesNotMatch(edition.text, /无条件胜利/);
  assert.deepEqual(edition.stories[0].facts, ['本地导出向所有用户开放']);
});

test('failed final review never falls back to an unreviewed valid draft', async () => {
  const id = prepareCandidates(raw)[0].id;
  await assert.rejects(curateDigest(raw, { now, extract, complete: async (_prompt, stage) => {
    if (stage === 'select') return { groups: [{ ids: [id], reason: 'test' }] };
    if (stage === 'write') return draft(id);
    throw new Error('review unavailable');
  } }), /review unavailable/);
});

test('one strong item stays one item, with source links and no forced homework', async () => {
  const id = prepareCandidates(raw)[0].id;
  const replies = [{ groups: [{ ids: [id], reason: 'New local capability' }] }, draft(id), draft(id)];
  const edition = await curateDigest(raw, { now, extract, complete: async () => replies.shift() });
  assert.equal(edition.stories.length, 1);
  assert.match(edition.text, /https:\/\/example.com\/video/);
  assert.doesNotMatch(edition.text, /概念卡片|思考题|为什么重要|继续观察/);
  assert.equal(edition.stories[0].facts[0], '本地导出向所有用户开放');
});

test('a citation still invalid after review drops the story and its history facts', async () => {
  const id = prepareCandidates(raw)[0].id;
  let calls = 0;
  const edition = await curateDigest(raw, { now, extract, complete: async () => {
    calls++;
    if (calls === 1) return { groups: [{ ids: [id], reason: 'test' }] };
    return draft(id, { facts: [{ text: '虚构', sourceId: id, quote: 'This quote does not exist.' }] });
  } });
  assert.equal(calls, 3);
  assert.deepEqual(edition.stories, []);
  assert.match(edition.omissions[0].reason, /Invalid evidence quote/);
  assert.match(edition.text, /可核实的信息有限/);
});

test('an invalid lead quote does not discard a supported brief', async () => {
  const data = { ...raw, hackerNews: [{ title: 'Second release', url: 'https://example.com/second', summary: text }] };
  const ids = prepareCandidates(data).map(item => item.id);
  const edition = await curateDigest(data, { now, extract, complete: async (_prompt, stage) => {
    if (stage === 'select') return { groups: ids.map(id => ({ ids: [id], reason: 'Separate releases' })) };
    return { stories: [draft(ids[0], { facts: [{ text: '无证据', sourceId: ids[0], quote: 'x'.repeat(501) }] }).stories[0],
      draft(ids[1], { slot: 'brief' }).stories[0]] };
  } });
  assert.equal(edition.stories.length, 1);
  assert.equal(edition.stories[0].slot, 'lead');
  assert.deepEqual(edition.stories[0].urls, ['https://example.com/second']);
  assert.doesNotMatch(edition.text, /无证据/);
});

test('the final gate retains one supported story per event even if review duplicates it', async () => {
  const data = { ...raw, hackerNews: [{ title: 'Same release elsewhere', url: 'https://example.com/coverage', summary: text }] };
  const ids = prepareCandidates(data).map(item => item.id);
  const edition = await curateDigest(data, { now, extract, complete: async (_prompt, stage) => {
    if (stage === 'select') return { groups: [{ ids, reason: 'Same event' }] };
    return { stories: [draft(ids[0], { event: 'Same release' }).stories[0], draft(ids[1], { slot: 'brief', event: 'Same release' }).stories[0]] };
  } });
  assert.equal(edition.stories.length, 1);
  assert.equal(edition.omissions[0].reason, 'Repeated event');
});

test('final length budget removes whole lower-priority stories without cutting sentences', async () => {
  const data = { aiBlogs: Array.from({ length: 4 }, (_, index) => ({ title: `AI ${index}`, link: `https://example.com/${index}`, summary: text })) };
  const ids = prepareCandidates(data).map(item => item.id);
  const stories = ids.map((id, index) => draft(id, { slot: ['lead', 'brief', 'brief', 'discovery'][index],
    facts: Array.from({ length: 3 }, (_, factIndex) => ({ text: '完整事实句'.repeat(factIndex === 0 ? 12 : 23) + '。', sourceId: id, quote: 'Local export is now available to all users.' })),
  }).stories[0]);
  const edition = await curateDigest(data, { now, extract,
    complete: async (_prompt, stage) => stage === 'select' ? { groups: ids.map(id => ({ ids: [id], reason: 'Separate events' })) } : { stories },
  });
  assert.ok(edition.stories.length > 0 && edition.stories.length < 4);
  assert.ok((edition.text.match(/\p{Script=Han}/gu) || []).length <= 900);
  assert.ok(edition.omissions.some(item => item.reason === 'length_budget'));
  assert.ok(edition.stories.every(item => item.facts.length === 3 && item.facts.every(fact => fact.endsWith('。'))));
});

test('unchanged full text is skipped even when the model proposes it again', async () => {
  const id = prepareCandidates(raw)[0].id;
  const history = [{ id: 'event-old', title: '旧事件', facts: ['已开放'], urls: ['https://example.com/video'],
    contentHashes: { 'https://example.com/video': 'new-hash' }, firstSentAt: now.toISOString(), lastSentAt: now.toISOString() }];
  let calls = 0;
  const edition = await curateDigest(raw, { now, history, extract, complete: async () => {
    calls++;
    return { groups: [{ ids: [id], reason: 'check update' }] };
  } });
  assert.equal(calls, 1);
  assert.equal(edition.stories.length, 0);
  assert.match(edition.text, /没有值得展开的新变化/);
});

test('same URL can carry a verified update and keep the original event identity', async () => {
  const id = prepareCandidates(raw)[0].id;
  const history = [{ id: 'event-old', title: '旧事件', facts: ['只对候补用户开放'], urls: ['https://example.com/video'],
    contentHashes: { 'https://example.com/video': 'old-hash' }, firstSentAt: '2026-09-04T00:00:00Z', lastSentAt: '2026-09-04T00:00:00Z' }];
  const replies = [{ groups: [{ ids: [id], reason: 'possible update' }] },
    draft(id, { historyId: 'event-old', novelty: 'update', change: '此前需要候补，现在向所有用户开放。' })];
  replies.push(replies[1]);
  const edition = await curateDigest(raw, { now, history, extract,
    recentKeys: new Set([normalize(raw.aiBlogs[0].link)]), complete: async () => replies.shift() });
  assert.equal(edition.stories[0].id, 'event-old');
  assert.match(edition.text, /新进展/);
});

test('quiet days distinguish unavailable sources from no important changes', async () => {
  const edition = await curateDigest({ sourceHealth: [{ source: 'Example', status: 'failed' }] }, { now, complete: async () => assert.fail('no items') });
  assert.match(edition.text, /可核实的信息有限/);
  assert.doesNotMatch(edition.text, /没有值得展开/);
});

test('same-day event grouping produces only one final story', async () => {
  const data = { ...raw, hackerNews: [{ title: raw.aiBlogs[0].title, url: 'https://news.example.com/coverage' }] };
  const ids = prepareCandidates(data).map(item => item.id);
  const replies = [{ groups: [{ ids, reason: 'Same release' }] },
    { stories: [draft(ids[0]).stories[0], { ...draft(ids[1]).stories[0], slot: 'brief' }] }, { stories: [] }];
  let calls = 0;
  const edition = await curateDigest(data, { now, extract, complete: async () => { calls++; return replies.shift(); } });
  assert.equal(calls, 3);
  assert.equal(edition.stories.length, 0);
});

test('unused draft prose cannot inject URLs or oversized text into the final message', async () => {
  const id = prepareCandidates(raw)[0].id;
  for (const bad of [draft(id, { body: '长'.repeat(701) }), draft(id, { body: '点这里 https://evil.example.com' })]) {
    const replies = [{ groups: [{ ids: [id], reason: 'test' }] }, bad, draft(id)];
    const edition = await curateDigest(raw, { now, extract, complete: async () => replies.shift() });
    assert.equal(replies.length, 0);
    assert.ok(edition.text.length < 3200);
    assert.doesNotMatch(edition.text, /evil/);
  }
});

test('publication and a separate incident about the same product can both appear', async () => {
  const data = { ...raw, hackerNews: [{ title: 'Example AI export service incident', url: 'https://example.com/incident', summary: 'An export service incident is being investigated.' }] };
  const ids = prepareCandidates(data).map(item => item.id);
  const article = 'An export service incident is being investigated. No root cause has been confirmed.';
  const replies = [{ groups: ids.map(id => ({ ids: [id], reason: 'different event' })) }, { stories: [draft(ids[0]).stories[0], {
    ...draft(ids[1]).stories[0], slot: 'brief', headline: '导出服务出现故障', body: '原因仍在调查。',
    facts: [{ text: '导出服务故障正在调查', sourceId: ids[1], quote: 'An export service incident is being investigated.' }],
  }] }];
  replies.push(replies[1]);
  const edition = await curateDigest(data, { now, complete: async () => replies.shift(),
    extract: async item => item.url.endsWith('/incident') ? { text: article, status: 'full', hash: 'incident-hash' } : extract() });
  assert.equal(edition.stories.length, 2);
});

test('whole preview chain uses optimizer, Readability, evidence checks, rendering and real files without history writes', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-preview-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const todayData = { ...raw, aiBlogs: [{ ...raw.aiBlogs[0], pubDate: new Date().toISOString() }] };
  const id = prepareCandidates(todayData)[0].id;
  const replies = [{ groups: [{ ids: [id], reason: 'test' }] }, draft(id), draft(id)];
  const edition = await generateTelegramEdition({ rawData: todayData, history: [], recentKeys: new Set(),
    complete: async () => replies.shift(), extract: item => extractArticle(item, { fetch: async () => ({
      html: `<article><h1>Local video export</h1><p>${text.repeat(5)}</p></article>`,
    }) }) });
  savePreview(edition, directory);
  assert.match(fs.readFileSync(path.join(directory, 'digest.txt'), 'utf8'), /本地导出向所有用户开放/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'edition.json'), 'utf8')).stories.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'candidates.json'), 'utf8')).aiBlogs.length, 1);
  assert.equal(edition.articles[0].article.status, 'full');
  assert.deepEqual(fs.readdirSync(directory).sort(), ['candidates.json', 'digest.txt', 'edition.json']);
});

test('migration suppression happens before source quotas and preserves unsent candidates', async () => {
  const old = Array.from({ length: 8 }, (_, i) => ({ title: `AI model agent coding launch ${i}`,
    link: `https://example.com/old-${i}`, summary: text, pubDate: new Date().toISOString() }));
  const fresh = { title: 'AI model release', link: 'https://example.com/fresh', summary: text, pubDate: new Date().toISOString() };
  const id = prepareCandidates({ aiBlogs: [fresh] })[0].id;
  const edition = await generateTelegramEdition({ rawData: { aiBlogs: [...old, fresh], sourceHealth: raw.sourceHealth },
    history: [], recentKeys: new Set(old.map(item => normalize(item.link))), extract,
    complete: async (_prompt, stage) => stage === 'select' ? { groups: [{ ids: [id], reason: 'new release' }] } : draft(id),
  });
  assert.deepEqual(edition.candidates.map(item => item.url), [fresh.link]);
  assert.equal(edition.stories.length, 1);
});

test('final editor can split a mistaken product group into distinct events', async () => {
  const data = { ...raw, hackerNews: [{ title: 'Example AI incident', url: 'https://example.com/incident', summary: text }] };
  const ids = prepareCandidates(data).map(item => item.id);
  const edition = await curateDigest(data, { now, extract, complete: async (_prompt, stage) => {
    if (stage === 'select') return { groups: [{ ids, event: 'Example AI news', reason: 'Incorrect product grouping' }] };
    return { stories: [draft(ids[0], { event: 'Local export release' }).stories[0],
      draft(ids[1], { event: 'Export service incident', slot: 'brief' }).stories[0]] };
  } });
  assert.equal(edition.stories.length, 2);
  assert.deepEqual(edition.stories.map(story => story.event), ['Local export release', 'Export service incident']);
});

test('final editor cannot reuse one source across regrouped stories', async () => {
  const id = prepareCandidates(raw)[0].id;
  const edition = await curateDigest(raw, { now, extract, complete: async (_prompt, stage) => stage === 'select'
    ? { groups: [{ ids: [id] }] }
    : { stories: [draft(id, { event: 'Release' }).stories[0], draft(id, { event: 'Another event', slot: 'brief' }).stories[0]] },
  });
  assert.equal(edition.stories.length, 1);
  assert.equal(edition.omissions[0].reason, 'Repeated event');
});

test('oversized first facts cannot become paragraph-length headlines', async () => {
  const id = prepareCandidates(raw)[0].id;
  const edition = await curateDigest(raw, { now, extract, complete: async (_prompt, stage) => stage === 'select'
    ? { groups: [{ ids: [id] }] }
    : draft(id, { facts: [{ text: '很长的标题'.repeat(20), sourceId: id, quote: text }] }),
  });
  assert.equal(edition.stories.length, 0);
  assert.match(edition.omissions[0].reason, /Invalid headline fact/);
});

test('an invalid broad story cannot collapse two valid regrouped stories', async () => {
  const data = { ...raw, hackerNews: [{ title: 'Example AI incident', url: 'https://example.com/incident', summary: text }] };
  const ids = prepareCandidates(data).map(item => item.id);
  const edition = await curateDigest(data, { now, extract, complete: async (_prompt, stage) => {
    if (stage === 'select') return { groups: [{ ids }] };
    return { stories: [draft(ids[0], { candidateIds: ids, facts: [] }).stories[0],
      draft(ids[0], { event: 'Release' }).stories[0], draft(ids[1], { event: 'Incident', slot: 'brief' }).stories[0]] };
  } });
  assert.equal(edition.stories.length, 2);
});

test('tracked same-URL updates remain eligible through the full migration filter', async () => {
  const url = raw.aiBlogs[0].link;
  const id = prepareCandidates(raw)[0].id;
  const history = [{ id: 'event-old', title: '旧事件', facts: ['只对候补用户开放'], urls: [url],
    contentHashes: { [url]: 'old-hash' }, firstSentAt: now.toISOString(), lastSentAt: now.toISOString() }];
  const edition = await generateTelegramEdition({ rawData: { ...raw, aiBlogs: [{ ...raw.aiBlogs[0], pubDate: new Date().toISOString() }] },
    history, recentKeys: new Set([normalize(url)]), extract,
    complete: async (_prompt, stage) => stage === 'select' ? { groups: [{ ids: [id] }] }
      : draft(id, { historyId: 'event-old', novelty: 'update' }),
  });
  assert.equal(edition.stories[0].id, 'event-old');
  assert.match(edition.text, /新进展/);
});

test('final editor receives all per-story mechanical errors in the one repair pass', async () => {
  const data = { ...raw, hackerNews: [{ title: 'Second release', url: 'https://example.com/second', summary: text }] };
  const ids = prepareCandidates(data).map(item => item.id);
  const edition = await curateDigest(data, { now, extract, complete: async (prompt, stage) => {
    if (stage === 'select') return { groups: ids.map(id => ({ ids: [id] })) };
    if (stage === 'write') return { stories: ids.map((id, index) => draft(id, {
      slot: index === 0 ? 'lead' : 'brief',
      facts: [{ text: '超长标题'.repeat(25), sourceId: id, quote: text }],
    }).stories[0]) };
    const problems = prompt.slice(prompt.indexOf('Mechanical problem to fix:'), prompt.indexOf('\nDRAFT '));
    assert.match(problems, new RegExp(`headline fact for ${ids[0]}`));
    assert.match(problems, new RegExp(`headline fact for ${ids[1]}`));
    return { stories: [draft(ids[0]).stories[0], draft(ids[1], { slot: 'brief' }).stories[0]] };
  } });
  assert.equal(edition.stories.length, 2);
  assert.deepEqual(edition.omissions, []);
});
