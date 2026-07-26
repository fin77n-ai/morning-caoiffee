const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DEEPSEEK_API_KEY ||= 'test-key';

const { buildCompletionOptions } = require('../scripts/telegram-digest');

test('uses DeepSeek V4 Pro without thinking for the daily digest', () => {
  const previousModel = process.env.DEEPSEEK_MODEL;
  delete process.env.DEEPSEEK_MODEL;

  try {
    const options = buildCompletionOptions('same morning prompt');

    assert.equal(options.model, 'deepseek-v4-pro');
    assert.deepEqual(options.thinking, { type: 'disabled' });
    assert.equal(options.max_tokens, 2200);
    assert.deepEqual(options.messages, [
      { role: 'user', content: 'same morning prompt' },
    ]);
  } finally {
    if (previousModel === undefined) {
      delete process.env.DEEPSEEK_MODEL;
    } else {
      process.env.DEEPSEEK_MODEL = previousModel;
    }
  }
});

test('allows an explicit model override', () => {
  const previousModel = process.env.DEEPSEEK_MODEL;
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';

  try {
    assert.equal(
      buildCompletionOptions('prompt').model,
      'deepseek-v4-flash'
    );
  } finally {
    if (previousModel === undefined) {
      delete process.env.DEEPSEEK_MODEL;
    } else {
      process.env.DEEPSEEK_MODEL = previousModel;
    }
  }
});
