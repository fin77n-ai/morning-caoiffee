require('dotenv').config({ quiet: true });
const axios = require('axios');
const fs = require('node:fs');
const path = require('node:path');
const { generateTelegramEdition, savePreview } = require('./telegram-digest');
const { recordSentDigest } = require('../src/sentHistory');
const { recordSentStories } = require('../src/storyHistory');

async function sendMessage(token, chatId, text, entities = []) {
  const { data } = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
    entities,
    link_preview_options: { is_disabled: true },
  }, { timeout: 30000 });
  if (!data.ok || !Number.isInteger(data.result?.message_id)) throw new Error('Invalid Telegram delivery response');
  return { message_id: data.result.message_id, date: data.result.date };
}

function saveDelivery(file, record) {
  if (!file) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally { fs.rmSync(temporary, { force: true }); }
}

async function deliverEdition(edition, {
  preview = false, send, recoveryPath,
  recordStories = recordSentStories, recordUrls = recordSentDigest,
} = {}) {
  if (preview) return;
  if (!edition.text || edition.text.length > 3200) throw new Error('Invalid V2 message length');
  const recovery = { version: 1, status: 'delivery_unknown', attemptedAt: new Date().toISOString(),
    text: edition.text, entities: edition.entities || [], stories: edition.stories };
  // Persist before the external side effect. A lost response is not proof of non-delivery.
  saveDelivery(recoveryPath, recovery);
  let receipt;
  try {
    receipt = await send(edition.text, recovery.entities);
  } catch (error) {
    const rejected = error.response?.status >= 400 && error.response?.status < 500 &&
      error.response?.data?.ok === false;
    recovery.status = rejected ? 'send_failed' : 'delivery_unknown';
    error.deliveryUnknown = !rejected;
    try { saveDelivery(recoveryPath, recovery); } catch { console.error('Could not update delivery recovery record.'); }
    throw error;
  }
  try {
    recovery.status = 'delivered';
    recovery.deliveredAt = new Date().toISOString();
    recovery.receipt = receipt && { message_id: receipt.message_id, date: receipt.date };
    saveDelivery(recoveryPath, recovery);
    recordStories(edition.stories);
    recordUrls(edition.text);
    recovery.status = 'history_saved_locally';
    saveDelivery(recoveryPath, recovery);
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
  await deliverEdition(edition, { send: (text, entities) => sendMessage(token, chatId, text, entities),
    recoveryPath: 'work/telegram-recovery/delivery.json' });
  console.log('Digest delivered.');
}

module.exports = { deliverEdition, sendMessage };

if (require.main === module) main().catch(async (err) => {
  console.error(err.message);
  // 旅行周读者收到沉默是最差体验：尽力发一条罢工通知（只带错误首行，不带响应体）
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_DEFAULT_CHAT_ID;
    if (token && chatId && !err.delivered && !err.deliveryUnknown) {
      const reason = String(err.message || err).split('\n')[0].slice(0, 200);
      await sendMessage(token, chatId, `⚠️ 今天早报罢工了：${reason}\n详情在 GitHub Actions 日志里，明天见。`);
    }
  } catch (alertErr) {
    console.error('Failed to send failure alert:', alertErr.message);
  }
  process.exit(1);
});
