require('dotenv').config();
const { scrapeAll } = require('./scraper');
const { summarize } = require('./summarize');
const { sendMail } = require('./mailer');
const { wrapInTemplate } = require('./template');

async function run() {
  console.log('☕ Morning cAoIffee is brewing...');
  const data = await scrapeAll();
  const contentHtml = await summarize(data);
  const dateStr = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });
  const html = wrapInTemplate(contentHtml, dateStr);
  await sendMail(html);
  console.log('✅ Done! Check your inbox.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
