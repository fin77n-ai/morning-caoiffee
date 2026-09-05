require('dotenv').config({ quiet: true });
const axios = require('axios');
const { generateTelegramEdition, savePreview } = require('./telegram-digest');
const { recordSentDigest } = require('../src/sentHistory');
const { recordSentStories } = require('../src/storyHistory');

async function sendMessage(token, chatId, text) {
  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
    link_preview_options: { is_disabled: true },
  }, { timeout: 30000 });
}

async function deliverEdition(edition, {
  preview = false, send,
  recordStories = recordSentStories, recordUrls = recordSentDigest,
} = {}) {
  if (preview) return;
  if (!edition.text || edition.text.length > 3200) throw new Error('Invalid V2 message length');
  await send(edition.text);
  try {
    recordStories(edition.stories);
    recordUrls(edition.text);
  } catch (error) {
    const failure = new Error(`Digest delivered, but history could not be saved: ${error.message}`);
    failure.delivered = true;
    throw failure;
  }
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_DEFAULT_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  }

  console.log('Morning cAoIffee Telegram digest is brewing...');
  const edition = await generateTelegramEdition();
  savePreview(edition, 'work/telegram-preview');
  await deliverEdition(edition, { send: text => sendMessage(token, chatId, text) });
  console.log('Digest delivered.');
}

module.exports = { deliverEdition };

if (require.main === module) main().catch(async (err) => {
  console.error(err.message);
  // 旅行周读者收到沉默是最差体验：尽力发一条罢工通知（只带错误首行，不带响应体）
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_DEFAULT_CHAT_ID;
    if (token && chatId && !err.delivered) {
      const reason = String(err.message || err).split('\n')[0].slice(0, 200);
      await sendMessage(token, chatId, `⚠️ 今天早报罢工了：${reason}\n详情在 GitHub Actions 日志里，明天见。`);
    }
  } catch (alertErr) {
    console.error('Failed to send failure alert:', alertErr.message);
  }
  process.exit(1);
});
