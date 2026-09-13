const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadStoryHistory, recordSentStories } = require('../src/storyHistory');
const { deliverEdition } = require('../scripts/send-telegram-digest');

const now = new Date('2026-09-05T00:00:00Z');
const story = { id: 'event-1', title: '示例事件', facts: ['第一条事实'], urls: ['https://example.com/a'], contentHashes: { 'https://example.com/a': 'hash-a' } };

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-v2-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'history.json');
}

test('history merges updates, retains first-send date and prunes expired events', t => {
  const file = temp(t);
  recordSentStories([{ ...story, id: 'expired' }], file, new Date('2026-07-01T00:00:00Z'));
  recordSentStories([story], file, now);
  const next = new Date('2026-09-06T00:00:00Z');
  recordSentStories([{ ...story, facts: ['第二条事实'] }], file, next);
  const entries = loadStoryHistory(file, next);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].facts, ['第一条事实', '第二条事实']);
  assert.equal(entries[0].firstSentAt, now.toISOString());
  assert.equal(entries[0].lastSentAt, next.toISOString());
});

test('malformed history is not silently overwritten', t => {
  const file = temp(t);
  fs.writeFileSync(file, '{broken');
  assert.throws(() => recordSentStories([story], file, now));
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});

test('preview writes no history and sends no messages', async t => {
  const file = temp(t);
  const edition = { text: '预览', stories: [story] };
  await deliverEdition(edition, { preview: true, send: async () => assert.fail('sent during preview'),
    recordStories: () => recordSentStories(edition.stories, file, now), recordUrls: () => assert.fail('URL ledger updated') });
  assert.equal(fs.existsSync(file), false);
});

test('send failure does not update either ledger', async t => {
  const file = temp(t);
  const edition = { text: '早报', stories: [story] };
  await assert.rejects(deliverEdition(edition, { send: async () => { throw new Error('send failed'); },
    recordStories: () => recordSentStories(edition.stories, file, now), recordUrls: () => assert.fail('URL ledger updated') }), /send failed/);
  assert.equal(fs.existsSync(file), false);
});

test('successful delivery writes real event state after sending', async t => {
  const file = temp(t);
  let sent = false;
  await deliverEdition({ text: '早报', stories: [story] }, {
    send: async () => { assert.equal(fs.existsSync(file), false); sent = true; },
    recordStories: stories => { assert.equal(sent, true); recordSentStories(stories, file, now); }, recordUrls: () => {},
  });
  assert.equal(loadStoryHistory(file, now)[0].id, 'event-1');
});

test('history failure after delivery is reported as already delivered', async () => {
  let sends = 0;
  await assert.rejects(deliverEdition({ text: '早报', stories: [story] }, {
    send: async () => { sends++; },
    recordStories: () => { throw new Error('disk full'); },
    recordUrls: () => assert.fail('must not continue after failed event persistence'),
  }), error => error.delivered === true && /disk full/.test(error.message));
  assert.equal(sends, 1);
});

test('delivery receipt survives local history failure and contains only recovery data', async t => {
  const recoveryPath = temp(t);
  await assert.rejects(deliverEdition({ text: '早报 https://example.com/a', stories: [story] }, {
    recoveryPath, send: async () => ({ message_id: 123, date: 1788652800, chat: { id: 'private' } }),
    recordStories: () => { throw new Error('disk full'); }, recordUrls: () => assert.fail('URL ledger updated'),
  }), error => error.delivered === true);
  const saved = JSON.parse(fs.readFileSync(recoveryPath, 'utf8'));
  assert.equal(saved.status, 'delivered');
  assert.deepEqual(saved.receipt, { message_id: 123, date: 1788652800 });
  assert.deepEqual(saved.stories, [story]);
  assert.equal(saved.text, '早报 https://example.com/a');
  assert.equal(saved.receipt.chat, undefined);
});

test('a send timeout leaves an unknown outcome without updating history', async t => {
  const recoveryPath = temp(t);
  await assert.rejects(deliverEdition({ text: '早报', stories: [story] }, {
    recoveryPath, send: async () => { throw new Error('timeout'); },
    recordStories: () => assert.fail('history updated'), recordUrls: () => assert.fail('URL ledger updated'),
  }), error => error.deliveryUnknown === true);
  assert.equal(JSON.parse(fs.readFileSync(recoveryPath, 'utf8')).status, 'delivery_unknown');
});

test('rejected send is distinguished from an unknown outcome', async t => {
  const recoveryPath = temp(t);
  await assert.rejects(deliverEdition({ text: '早报', stories: [story] }, {
    recoveryPath, send: async () => { throw Object.assign(new Error('rejected'), { response: { status: 400, data: { ok: false } } }); },
  }), error => !error.deliveryUnknown);
  assert.equal(JSON.parse(fs.readFileSync(recoveryPath, 'utf8')).status, 'send_failed');
});

test('recovery write failure aborts before sending', async t => {
  const file = temp(t);
  fs.writeFileSync(file, 'not a directory');
  let sends = 0;
  await assert.rejects(deliverEdition({ text: '早报', stories: [story] }, {
    recoveryPath: path.join(file, 'delivery.json'), send: async () => { sends++; },
  }));
  assert.equal(sends, 0);
});

test('successful delivery records local history status and keeps preview side-effect free', async t => {
  const recoveryPath = temp(t);
  const file = path.join(path.dirname(recoveryPath), 'stories.json');
  const edition = { text: '早报', stories: [story] };
  await deliverEdition(edition, { preview: true, recoveryPath, send: async () => assert.fail('preview sent') });
  assert.equal(fs.existsSync(recoveryPath), false);
  await deliverEdition(edition, { recoveryPath, send: async () => ({ message_id: 42, date: 1788652800 }),
    recordStories: stories => recordSentStories(stories, file, now), recordUrls: () => {},
  });
  assert.equal(JSON.parse(fs.readFileSync(recoveryPath)).status, 'history_saved_locally');
  assert.equal(loadStoryHistory(file, now)[0].id, story.id);
});

test('Telegram response is reduced to a receipt without recipient details', async t => {
  const axios = require('axios');
  const { sendMessage } = require('../scripts/send-telegram-digest');
  t.mock.method(axios, 'post', async () => ({ data: { ok: true,
    result: { message_id: 123, date: 1788652800, chat: { id: 'private' }, text: '早报' } } }));
  assert.deepEqual(await sendMessage('test-token', 'test-chat', '早报'), { message_id: 123, date: 1788652800 });
});

test('an invalid Telegram success response is never treated as delivered', async t => {
  const axios = require('axios');
  const { sendMessage } = require('../scripts/send-telegram-digest');
  t.mock.method(axios, 'post', async () => ({ data: { ok: true, result: {} } }));
  const recoveryPath = temp(t);
  await assert.rejects(deliverEdition({ text: '早报', stories: [story] }, {
    recoveryPath, send: text => sendMessage('test-token', 'test-chat', text),
    recordStories: () => assert.fail('history updated'), recordUrls: () => assert.fail('history updated'),
  }), error => error.deliveryUnknown === true);
  assert.equal(JSON.parse(fs.readFileSync(recoveryPath)).status, 'delivery_unknown');
});

test('an intermediary HTTP error without Telegram acknowledgement remains unknown', async t => {
  const recoveryPath = temp(t);
  await assert.rejects(deliverEdition({ text: '早报', stories: [story] }, {
    recoveryPath, send: async () => { throw Object.assign(new Error('gateway timeout'), { response: { status: 408, data: '<html>Timeout</html>' } }); },
    recordStories: () => assert.fail('history updated'), recordUrls: () => assert.fail('history updated'),
  }), error => error.deliveryUnknown === true);
  assert.equal(JSON.parse(fs.readFileSync(recoveryPath)).status, 'delivery_unknown');
});
