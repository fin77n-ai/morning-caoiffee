const { scrapeAll } = require('../src/scraper');
const { optimizeContent } = require('../src/optimizeContent');
const { buildPrompt } = require('../src/summarize');

async function main() {
  console.log('Dry run: scrape -> optimize -> build prompt');

  const rawData = await scrapeAll();
  const optimizedData = optimizeContent(rawData);
  const prompt = buildPrompt(optimizedData);

  printSourceHealth(optimizedData.sourceHealth);
  console.log('Input counts:', optimizedData.optimization.inputCounts);
  console.log('Output counts:', optimizedData.optimization.outputCounts);
  console.log('Failed sources:', optimizedData.optimization.failedSources);
  console.log('Prompt characters:', prompt.length);
  console.log('\nPrompt preview:\n');
  console.log(prompt.slice(0, 1800));
}

function printSourceHealth(sourceHealth = []) {
  const failed = sourceHealth.filter((source) => source.status === 'failed');
  console.log(`Source health: ${sourceHealth.length - failed.length}/${sourceHealth.length} sources ok`);

  for (const source of sourceHealth) {
    const detail = source.status === 'ok'
      ? `${source.count} items`
      : source.error;
    console.log(`- ${source.status.toUpperCase()} ${source.source}: ${detail}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
