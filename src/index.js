require('dotenv').config();
const { scrapeAll } = require('./scraper');
const { summarize } = require('./summarize');
const { sendMail } = require('./mailer');

async function run() {
  console.log('☕ Morning cAoIffee is brewing...');
  const data = await scrapeAll();
  const summary = await summarize(data);
  await sendMail(summary);
  console.log('✅ Done! Check your inbox.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
