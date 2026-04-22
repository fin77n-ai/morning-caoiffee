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

async function scrapeHuggingFace() {
  const { data } = await axios.get('https://huggingface.co/blog');
  const $ = cheerio.load(data);
  const items = [];

  $('a').each((i, el) => {
    const href = $(el).attr('href');
    const h4 = $(el).find('h4');
    if (h4.length && href) {
      const text = h4.text().trim();
      if (text && items.length < 8) {
        const url = href.startsWith('http') ? href : `https://huggingface.co${href}`;
        items.push({ title: text, url });
      }
    }
  });

  return items;
}

async function scrapeAll() {
  console.log('Scraping sources...');

  const [hackerNews, huggingFace] = await Promise.all([
    scrapeHackerNews(),
    scrapeHuggingFace(),
  ]);

  return { hackerNews, huggingFace };
}

module.exports = { scrapeAll };
