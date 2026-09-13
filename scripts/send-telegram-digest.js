require('dotenv').config();
const axios = require('axios');
const { recordSentDigest } = require('../src/sentHistory');

// Telegram 单条消息上限 4096 字符；留余量。
// 优先按 ━━━ 分隔线整栏切段（"看点"和"链接"永不分家），单栏超长再退回按行切。
function splitDigest(text, limit = 3500) {
  const blocks = [];
  let current = [];
  for (const line of text.split('\n')) {
    if (/^━+$/.test(line.trim()) && current.length) {
      blocks.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n'));

  const chunks = [];
  let packed = '';
  for (const block of blocks) {
    if (block.length > limit) {
      if (packed.trim()) chunks.push(packed);
      packed = '';
      chunks.push(...splitByLines(block, limit));
      continue;
    }
    if (packed && packed.length + block.length + 1 > limit) {
      chunks.push(packed);
      packed = block;
    } else {
      packed = packed ? `${packed}\n${block}` : block;
    }
  }
  if (packed.trim()) chunks.push(packed);
  return chunks;
}

function splitByLines(text, limit = 3500) {
  const chunks = [];
  let current = '';
  for (let line of text.split('\n')) {
    while (line.length > limit) {
      chunks.push(line.slice(0, limit));
      line = line.slice(limit);
    }
    if (current && current.length + line.length + 1 > limit) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

// Only fold explanation lines from the existing prompt; unfamiliar output stays visible.
// Run after splitting so offsets are relative to the exact message being sent.
function detailEntities(text) {
  const entities = [];
  const detail = /^\s*(?:为什么重要|继续观察|看点|能做什么|这帖在聊什么|为什么值得围观|一句话解释|今天为什么出现|我该怎么记|为什么值得想)[：:]/;
  let offset = 0;
  let start = null;
  let end = 0;
  const flush = () => {
    if (start !== null) entities.push({ type: 'expandable_blockquote', offset: start, length: end - start });
    start = null;
  };
  for (const line of text.split('\n')) {
    // URLs always remain visible, even if the model puts one on a detail line.
    if (detail.test(line) && !/https?:\/\//i.test(line)) {
      if (start === null) start = offset;
      end = offset + line.length;
    } else {
      flush();
    }
    // JavaScript lengths use UTF-16 code units, as required by Telegram.
    offset += line.length + 1;
  }
  flush();
  return entities;
}

async function sendMessage(token, chatId, text) {
  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
    entities: detailEntities(text),
    link_preview_options: { is_disabled: true },
  }, { timeout: 30000 });
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_DEFAULT_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  }

  console.log('Morning cAoIffee Telegram digest is brewing...');
  const { generateTelegramDigest } = require('./telegram-digest');
  const digest = await generateTelegramDigest();
  const chunks = splitDigest(digest.trim());
  for (const [index, chunk] of chunks.entries()) {
    await sendMessage(token, chatId, chunk);
    console.log(`Sent chunk ${index + 1}/${chunks.length} (${chunk.length} chars)`);
  }
  console.log('Digest delivered.');

  // 发送成功才记账（记账失败不算发送失败，别让 Actions 标红吓人）
  try {
    const recorded = recordSentDigest(digest);
    console.log(`Sent history recorded: ${recorded} keys.`);
  } catch (historyErr) {
    console.warn('Failed to record sent history:', historyErr.message);
  }
}

module.exports = { splitDigest, detailEntities, sendMessage };

if (require.main === module) main().catch(async (err) => {
  console.error(err.response ? JSON.stringify(err.response.data) : err);
  // 旅行周读者收到沉默是最差体验：尽力发一条罢工通知（只带错误首行，不带响应体）
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_DEFAULT_CHAT_ID;
    if (token && chatId) {
      const reason = String(err.message || err).split('\n')[0].slice(0, 200);
      await sendMessage(token, chatId, `⚠️ 今天早报罢工了：${reason}\n详情在 GitHub Actions 日志里，明天见。`);
    }
  } catch (alertErr) {
    console.error('Failed to send failure alert:', alertErr.message);
  }
  process.exit(1);
});
