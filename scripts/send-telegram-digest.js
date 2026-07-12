require('dotenv').config();
const axios = require('axios');
const { generateTelegramDigest } = require('./telegram-digest');

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

async function sendMessage(token, chatId, text) {
  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
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
  const digest = await generateTelegramDigest();
  const chunks = splitDigest(digest.trim());
  for (const [index, chunk] of chunks.entries()) {
    await sendMessage(token, chatId, chunk);
    console.log(`Sent chunk ${index + 1}/${chunks.length} (${chunk.length} chars)`);
  }
  console.log('Digest delivered.');
}

main().catch(async (err) => {
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
