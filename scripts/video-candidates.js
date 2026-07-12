require('dotenv').config();
const { scrapeAll } = require('../src/scraper');
const { optimizeContent } = require('../src/optimizeContent');

async function main() {
  const rawData = await scrapeAll();
  const data = optimizeContent(rawData);
  const candidates = buildVideoCandidates(data);

  console.log('--- VIDEO_CANDIDATES_START ---');
  console.log(JSON.stringify(candidates, null, 2));
  console.log('--- VIDEO_CANDIDATES_END ---');
}

function buildVideoCandidates(data) {
  return (data.podcasts || [])
    .filter((item) => item.link && item.title)
    .map((item) => ({
      title: item.title,
      url: item.link,
      source: item.podcast || 'Podcast',
      reason: item.reason || item.categoryLabel || 'selected from Morning cAoIffee podcasts',
      rank: item.rank || null,
      description: item.description || '',
      pubDate: item.pubDate || '',
    }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
