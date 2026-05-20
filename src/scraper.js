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

async function scrapeReddit() {
  const subreddits = ['MachineLearning', 'LocalLLaMA', 'artificial'];
  const results = [];

  for (const sub of subreddits) {
    try {
      const { data } = await axios.get(`https://www.reddit.com/r/${sub}/hot.json?limit=3`, {
        headers: { 'User-Agent': 'morning-caoiffee/1.0' },
        timeout: 10000,
      });
      const posts = data.data.children
        .filter(p => !p.data.stickied)
        .slice(0, 3)
        .map(p => ({
          subreddit: sub,
          title: p.data.title,
          url: `https://reddit.com${p.data.permalink}`,
          score: p.data.score,
          comments: p.data.num_comments,
        }));
      results.push(...posts);
    } catch (e) {
      // skip silently
    }
  }

  return results;
}

async function scrapeAIBlogs() {
  const feeds = [
    { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/' },
    { name: 'The Batch (deeplearning.ai)', url: 'https://www.deeplearning.ai/the-batch/feed/' },
  ];

  const results = [];

  for (const feed of feeds) {
    try {
      const { data } = await axios.get(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });
      const $ = cheerio.load(data, { xmlMode: true });
      const item = $('entry, item').first();
      const title = item.find('title').first().text().trim();
      const link = item.find('link').attr('href') || item.find('link').first().text().trim();
      const summary = (item.find('summary, description').first().text() || '')
        .replace(/<[^>]+>/g, '').trim().slice(0, 300);
      if (title) {
        results.push({ author: feed.name, title, link, summary });
      }
    } catch (e) {
      // skip silently
    }
  }

  return results;
}

async function scrapeDataTools() {
  const results = [];

  // DuckDB blog (RSS)
  try {
    const { data } = await axios.get('https://duckdb.org/feed.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    });
    const $ = cheerio.load(data, { xmlMode: true });
    $('item, entry').slice(0, 3).each((i, el) => {
      const item = $(el);
      const title = item.find('title').first().text().trim();
      const link = item.find('link').attr('href') || item.find('link').first().text().trim();
      const summary = (item.find('summary, description').first().text() || '')
        .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 240);
      if (title) results.push({ source: 'DuckDB', title, link, summary });
    });
  } catch (e) { /* skip silently */ }

  // ChromaDB GitHub releases (atom)
  try {
    const { data } = await axios.get('https://github.com/chroma-core/chroma/releases.atom', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    });
    const $ = cheerio.load(data, { xmlMode: true });
    $('entry').slice(0, 2).each((i, el) => {
      const item = $(el);
      const title = item.find('title').first().text().trim();
      const link = item.find('link').attr('href') || '';
      const summary = (item.find('content').first().text() || '')
        .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 240);
      if (title) results.push({ source: 'ChromaDB', title, link, summary });
    });
  } catch (e) { /* skip silently */ }

  // SQLite news
  try {
    const { data } = await axios.get('https://www.sqlite.org/news.html', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const firstH3 = $('h3').first();
    const title = firstH3.text().replace(/\s+/g, ' ').trim();
    if (title) {
      const summary = firstH3.nextUntil('h3').text().replace(/\s+/g, ' ').trim().slice(0, 240);
      results.push({ source: 'SQLite', title, link: 'https://www.sqlite.org/news.html', summary });
    }
  } catch (e) { /* skip silently */ }

  return results;
}

async function scrapeAll() {
  console.log('Scraping sources...');

  const [hackerNews, githubTrending, podcasts, reddit, aiBlogs, dataTools] = await Promise.all([
    scrapeHackerNews(),
    scrapeGitHubTrending(),
    scrapePodcasts(),
    scrapeReddit(),
    scrapeAIBlogs(),
    scrapeDataTools(),
  ]);

  return { hackerNews, githubTrending, podcasts, reddit, aiBlogs, dataTools };
}

module.exports = { scrapeAll };
