const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeHackerNews() {
  const { data } = await axios.get('https://news.ycombinator.com');
  const $ = cheerio.load(data);
  const items = [];

  $('.athing').each((i, el) => {
    if (i >= 15) return false;
    const titleEl = $(el).find('.titleline > a');
    const text = titleEl.text().trim();
    const href = titleEl.attr('href');
    if (text) items.push({ title: text, url: href || '#' });
  });

  return items;
}

async function scrapeGitHubTrending() {
  const { data } = await axios.get('https://github.com/trending', {
    headers: { 'Accept-Language': 'en-US,en;q=0.9' }
  });
  const $ = cheerio.load(data);
  const items = [];

  $('article.Box-row').each((i, el) => {
    if (i >= 5) return false;
    const repoEl = $(el).find('h2 a');
    const name = repoEl.text().replace(/\s+/g, '').trim();
    const href = repoEl.attr('href');
    const description = $(el).find('p').text().trim();
    const stars = $(el).find('.octicon-star').parent().text().trim();
    if (name && href) {
      items.push({
        name,
        url: `https://github.com${href}`,
        description: description || '',
        stars: stars || '',
      });
    }
  });

  return items;
}

async function scrapePodcasts() {
  const feeds = [
    { name: 'Dwarkesh Podcast', url: 'https://www.dwarkesh.com/feed' },
    { name: 'Lex Fridman Podcast', url: 'https://lexfridman.com/feed/podcast/' },
  ];

  const results = [];

  for (const feed of feeds) {
    try {
      const { data } = await axios.get(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });
      const $ = cheerio.load(data, { xmlMode: true });
      const item = $('item').first();
      const title = item.find('title').first().text().trim();
      const link = item.find('link').first().text().trim();
      const description = item.find('description').first().text().replace(/<[^>]+>/g, '').trim().slice(0, 300);
      const pubDate = item.find('pubDate').first().text().trim();
      if (title) {
        results.push({ podcast: feed.name, title, link, description, pubDate });
      }
    } catch (e) {
      // skip failed feeds silently
    }
  }

  return results;
}

async function scrapeAll() {
  console.log('Scraping sources...');

  const [hackerNews, githubTrending, podcasts] = await Promise.all([
    scrapeHackerNews(),
    scrapeGitHubTrending(),
    scrapePodcasts(),
  ]);

  return { hackerNews, githubTrending, podcasts };
}

module.exports = { scrapeAll };
