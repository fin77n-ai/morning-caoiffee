const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT, loadHistory, validateConfig, selectChapter, buildTopicMessage, deliverTopic,
} = require('../src/monthlyTopic');

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'monthly-topics.json'), 'utf8'));
  validateConfig(config);
  const history = loadHistory();
  const selection = selectChapter(config, history);
  if (!selection) {
    console.log('No topic notification due: this week is done, or all available chapters are delivered.');
    return;
  }
  if (!process.argv.includes('--send')) {
    console.log(buildTopicMessage(selection));
    return;
  }
  require('dotenv').config();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_DEFAULT_CHAT_ID;
  if (!token || !chatId) throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  const { sendMessage } = require('./send-telegram-digest');
  await deliverTopic({ config, history, send: message => sendMessage(token, chatId, message) });
  console.log(`Delivered ${selection.topic.id} chapter ${selection.chapter.id}.`);
}

if (require.main === module) main().catch(() => {
  // Avoid printing HTTP errors containing bot credentials.
  console.error('Topic delivery failed. Check configuration, Telegram access and delivery history before retrying.');
  process.exitCode = 1;
});
