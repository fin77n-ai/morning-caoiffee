const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  ROOT, localDay, loadHistory, validateConfig, selectChapter,
  buildTopicMessage, deliverTopic, saveHistory,
} = require('../src/monthlyTopic');
const config = require('../config/monthly-topics.json');
const now = new Date('2026-10-11T23:00:00Z');
const empty = () => ({ deliveries: [] });
const entry = (chapterId, week = '2026-10-05') => ({
  topicId: config.topics[0].id, chapterId, day: week, week,
});

test('Shanghai Monday boundary and repeated triggers allow at most one chapter per local week', () => {
  const history = { deliveries: [entry('01')] };
  assert.equal(localDay(now, config.timeZone), '2026-10-12');
  assert.equal(selectChapter(config, history, new Date('2026-10-11T15:59:59Z')), null);
  const selection = selectChapter(config, history, new Date('2026-10-11T16:00:00Z'));
  assert.equal(selection.chapter.id, '02');
  assert.equal(selection.week, '2026-10-12');
  history.deliveries.push(entry('02', '2026-10-12'));
  assert.equal(selectChapter(config, history, now), null);
});

test('missed weeks and month boundaries preserve chapter order; future topics stay closed', () => {
  const november = { ...config.topics[0], id: '2026-11-next', month: '2026-11' };
  const combined = { ...config, topics: [november, ...config.topics] };
  assert.equal(selectChapter(config, empty(), new Date('2026-09-30T15:00:00Z')), null);
  const history = { deliveries: [entry('01'), entry('02')] };
  assert.equal(selectChapter(combined, history, new Date('2026-11-02T00:00:00Z')).chapter.id, '03');
  history.deliveries.push(entry('03'), entry('04'));
  assert.equal(selectChapter(combined, history, now), null);
  assert.equal(selectChapter(combined, history, new Date('2026-11-02T00:00:00Z')).topic.id, november.id);
  assert.equal(selectChapter(config, history, new Date('2027-01-01T00:00:00Z')), null);
});

test('a failed send never updates state; successful sends persist and prevent another send', async () => {
  let saved;
  await assert.rejects(deliverTopic({ config, history: empty(), now,
    send: async () => { throw new Error('network failure'); }, save: value => { saved = value; },
  }), /network failure/);
  assert.equal(saved, undefined);
  const sent = [];
  await deliverTopic({ config, history: empty(), now,
    send: async message => sent.push(message), save: value => { saved = value; },
  });
  assert.equal(saved.deliveries[0].chapterId, '01');
  assert.equal(await deliverTopic({ config, history: saved, now,
    send: async message => sent.push(message), save: () => assert.fail('should not save'),
  }), null);
  assert.equal(sent.length, 1);
});

test('delivery history round-trips; corrupt state fails instead of resending the first chapter', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'monthly-topic-'));
  const file = path.join(dir, 'history.json');
  t.after(() => {
    fs.rmSync(file, { force: true });
    fs.rmSync(`${file}.tmp`, { force: true });
    fs.rmdirSync(dir);
  });
  assert.deepEqual(loadHistory(file), empty());
  const history = { deliveries: [entry('01')] };
  saveHistory(history, file);
  assert.deepEqual(loadHistory(file), history);
  for (const text of ['{', '{}', 'null', '{"deliveries":[{}]}']) {
    fs.writeFileSync(file, text);
    assert.throws(() => loadHistory(file), /history/);
  }
});

test('real curriculum has four existing articles and working local Markdown navigation', () => {
  validateConfig(config);
  for (const topic of config.topics) {
    const base = path.join(ROOT, 'docs', 'topics', topic.id);
    for (const filename of ['README.md', ...topic.chapters.map(chapter => chapter.file)]) {
      const text = fs.readFileSync(path.join(base, filename), 'utf8');
      for (const match of text.matchAll(/\]\(([^)]+\.md)\)/g)) {
        assert.ok(fs.existsSync(path.resolve(base, match[1])), `Broken link: ${filename} -> ${match[1]}`);
      }
    }
  }
  const invalid = structuredClone(config);
  invalid.topics[0].chapters[0].file = '../escape.md';
  assert.throws(() => validateConfig(invalid), /Invalid chapter/);
});

test('notification fits one message, links to full article and directory, and includes previous chapter', () => {
  const selection = selectChapter(config, { deliveries: [entry('01')] }, now);
  const message = buildTopicMessage(selection);
  assert.ok(message.length < 3500);
  assert.match(message, /第 2\/4 篇/);
  for (const filename of ['README.md', '01-pick-a-task.md', '02-design-the-workflow.md']) {
    assert.ok(message.includes(`/blob/main/docs/topics/2026-10-ai-workflows/${filename}`));
  }
});
