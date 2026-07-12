require('dotenv').config();
const axios = require('axios');
const { generateTelegramDigest } = require('./telegram-digest');

// Telegram 单条消息上限 4096 字符；留余量并按行切，避免把句子拦腰砍断。
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
  const chunks = splitByLines(digest.trim());
  for (const [index, chunk] of chunks.entries()) {
    await sendMessage(token, chatId, chunk);
    console.log(`Sent chunk ${index + 1}/${chunks.length} (${chunk.length} chars)`);
  }
  console.log('Digest delivered.');
}

main().catch((err) => {
  console.error(err.response ? JSON.stringify(err.response.data) : err);
  process.exit(1);
});
