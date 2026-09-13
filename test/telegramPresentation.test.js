const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { splitDigest, detailEntities, sendMessage } = require('../scripts/send-telegram-digest');

const digest = `☕ Morning cAoIffee · 9月13日

先看这 3 件事
1. 🧪 Example AI 更新
   为什么重要：这里是原来的解释，没有改写。
   继续观察：这里是原来的观察点。
   链接：https://example.com/news

━━━━━━━━━━━━
概念卡片
概念：词元
一句话解释：原来的概念解释。
今天为什么出现：原来的背景。
我该怎么记：原来的记忆方法。

━━━━━━━━━━━━
今天留给我的问题
问题：原来的问题？
为什么值得想：原来的理由。`;

function folded(text) {
  return detailEntities(text).map(e => text.slice(e.offset, e.offset + e.length));
}

test('only explanations fold; titles, sections, questions and source links stay visible', () => {
  const expected = [
    '   为什么重要：这里是原来的解释，没有改写。\n   继续观察：这里是原来的观察点。',
    '一句话解释：原来的概念解释。\n今天为什么出现：原来的背景。\n我该怎么记：原来的记忆方法。',
    '为什么值得想：原来的理由。',
  ];
  assert.deepEqual(folded(digest), expected);
  for (const entity of detailEntities(digest)) {
    assert.equal(entity.type, 'expandable_blockquote');
    assert.equal(digest[entity.offset - 1], '\n');
    assert.ok(entity.offset + entity.length === digest.length || digest[entity.offset + entity.length] === '\n');
  }
  assert.ok(detailEntities(digest)[0].offset > [...digest.slice(0, detailEntities(digest)[0].offset)].length,
    'emoji before details must count as UTF-16 surrogate pairs');
});

test('all existing section explanation labels are recognized', () => {
  for (const label of ['看点', '能做什么', '这帖在聊什么', '为什么值得围观']) {
    const line = `   ${label}：原来的说明。`;
    assert.deepEqual(folded(line), [line]);
  }
});

test('unrecognized layouts and any line containing a source URL remain visible', () => {
  assert.deepEqual(detailEntities('没有特别值得追的项目。\n未知字段：保持原样。'), []);
  assert.deepEqual(detailEntities('看点：https://example.com 不藏链接'), []);
  assert.deepEqual(detailEntities(''), []);
});

test('each split message uses its own offsets and retains the original text', () => {
  const chunks = splitDigest(digest, 180);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join('\n'), digest);
  assert.deepEqual(chunks.flatMap(folded), folded(digest));
  assert.ok(chunks.every(chunk => chunk.length <= 180));
});

test('sender keeps the exact original message and adds native entities without markup', async t => {
  const chunks = splitDigest(digest, 180);
  const payloads = [];
  t.mock.method(axios, 'post', async (_url, payload) => {
    payloads.push(payload);
    return { data: { ok: true } };
  });
  for (const chunk of chunks) await sendMessage('test-token', 'test-chat', chunk);
  assert.deepEqual(payloads.map(p => p.text), chunks);
  assert.deepEqual(payloads.map(p => p.entities), chunks.map(detailEntities));
  assert.ok(payloads.every(p => p.parse_mode === undefined && p.link_preview_options.is_disabled));
});
