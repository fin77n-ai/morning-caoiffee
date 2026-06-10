require('dotenv').config();
const { scrapeAll } = require('./scraper');
const { optimizeContent } = require('./optimizeContent');
const { summarize } = require('./summarize');
const { sendMail } = require('./mailer');
const { wrapInTemplate } = require('./template');

async function run() {
  console.log('☕ Morning cAoIffee is brewing...');
  const rawData = await scrapeAll();
  const data = optimizeContent(rawData);
  console.log('Content optimized:', data.optimization.outputCounts);
  logSourceHealth(data.sourceHealth);
  const contentHtml = await summarize(data);
  const dateStr = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });
  const html = wrapInTemplate(contentHtml, dateStr);
  await sendMail(html);
  console.log('✅ Done! Check your inbox.');
}

function logSourceHealth(sourceHealth = []) {
  const failed = sourceHealth.filter((source) => source.status === 'failed');
  console.log(
    `Source health: ${sourceHealth.length - failed.length}/${sourceHealth.length} sources ok`
  );

  for (const source of failed) {
    console.warn(`Source failed: ${source.source} - ${source.error}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
