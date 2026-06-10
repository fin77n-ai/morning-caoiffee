const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeHackerNews() {
  try {
    const { data } = await axios.get('https://news.ycombinator.com', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    });
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
  } catch (e) {
    throw new Error(`Hacker News failed: ${e.message}`);
  }
}

async function scrapeGitHubTrending() {
  try {
    const { data } = await axios.get('https://github.com/trending', {
      headers: { 'Accept-Language': 'en-US,en;q=0.9', 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
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
  } catch (e) {
    throw new Error(`GitHub Trending failed: ${e.message}`);
  }
}

async function scrapeSource(sourceName, fn) {
  try {
    const items = await fn();
    return {
      items,
      health: { source: sourceName, status: 'ok', count: items.length },
    };
  } catch (e) {
    return {
      items: [],
      health: { source: sourceName, status: 'failed', count: 0, error: e.message },
    };
  }
}

async function scrapeFeedItems(feed, parseItems) {
  try {
    const { data } = await axios.get(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    });
    const items = parseItems(data, feed);
    return {
      items,
      health: { source: feed.name, status: 'ok', count: items.length },
    };
  } catch (e) {
    return {
      items: [],
      health: { source: feed.name, status: 'failed', count: 0, error: e.message },
    };
  }
}

async function scrapeRedditSubreddit(sub) {
  try {
    const { data } = await axios.get(`https://www.reddit.com/r/${sub}/hot.json?limit=3`, {
      headers: { 'User-Agent': 'morning-caoiffee/1.0' },
      timeout: 10000,
    });
    const items = data.data.children
      .filter(p => !p.data.stickied)
      .slice(0, 3)
      .map(p => ({
        subreddit: sub,
        title: p.data.title,
        url: `https://reddit.com${p.data.permalink}`,
        score: p.data.score,
        comments: p.data.num_comments,
      }));

    return {
      items,
      health: { source: `Reddit r/${sub}`, status: 'ok', count: items.length },
    };
  } catch (e) {
    return {
      items: [],
      health: { source: `Reddit r/${sub}`, status: 'failed', count: 0, error: e.message },
    };
  }
}

async function scrapePodcasts() {
  const feeds = [
    { name: 'Dwarkesh Podcast', url: 'https://www.dwarkesh.com/feed' },
    { name: 'Lex Fridman Podcast', url: 'https://lexfridman.com/feed/podcast/' },
  ];

  const results = [];
  const health = [];

  for (const feed of feeds) {
    const result = await scrapeFeedItems(feed, (data) => {
      const $ = cheerio.load(data, { xmlMode: true });
      const item = $('item').first();
      const title = item.find('title').first().text().trim();
      const link = item.find('link').first().text().trim();
      const description = item.find('description').first().text().replace(/<[^>]+>/g, '').trim().slice(0, 300);
      const pubDate = item.find('pubDate').first().text().trim();
      return title ? [{ podcast: feed.name, title, link, description, pubDate }] : [];
    });
    results.push(...result.items);
    health.push(result.health);
  }

  return { items: results, health };
}

async function scrapeReddit() {
  const subreddits = ['MachineLearning', 'LocalLLaMA', 'artificial'];
  const results = [];
  const health = [];

  for (const sub of subreddits) {
    const result = await scrapeRedditSubreddit(sub);
    results.push(...result.items);
    health.push(result.health);
  }

  return { items: results, health };
}

async function scrapeAIBlogs() {
  const feeds = [
    { name: 'OpenAI News', url: 'https://openai.com/news/rss.xml', limit: 2 },
    { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', limit: 2 },
    { name: 'Google DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml', limit: 2 },
    { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', limit: 2 },
    { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', limit: 1 },
    { name: 'The Batch (deeplearning.ai)', url: 'https://www.deeplearning.ai/the-batch/feed/', limit: 1 },
  ];

  const results = [];
  const health = [];

  for (const feed of feeds) {
    const result = await scrapeFeedItems(feed, (data) => {
      const $ = cheerio.load(data, { xmlMode: true });
      const items = [];
      $('entry, item').slice(0, feed.limit).each((i, el) => {
        const item = $(el);
        const title = item.find('title').first().text().trim();
        const link = item.find('link').attr('href') || item.find('link').first().text().trim();
        const summary = (item.find('summary, description, content').first().text() || '')
          .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
        if (title) {
          items.push({ author: feed.name, title, link, summary });
        }
      });
      return items;
    });
    results.push(...result.items);
    health.push(result.health);
  }

  return { items: results, health };
}

async function scrapeDataTools() {
  const results = [];
  const health = [];

  // DuckDB blog (RSS)
  const duckDb = await scrapeFeedItems({ name: 'DuckDB', url: 'https://duckdb.org/feed.xml' }, (data) => {
    const $ = cheerio.load(data, { xmlMode: true });
    const items = [];
    $('item, entry').slice(0, 3).each((i, el) => {
      const item = $(el);
      const title = item.find('title').first().text().trim();
      const link = item.find('link').attr('href') || item.find('link').first().text().trim();
      const summary = (item.find('summary, description').first().text() || '')
        .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 240);
      if (title) items.push({ source: 'DuckDB', title, link, summary });
    });
    return items;
  });
  results.push(...duckDb.items);
  health.push(duckDb.health);

  // ChromaDB GitHub releases (atom)
  const chroma = await scrapeFeedItems({ name: 'ChromaDB', url: 'https://github.com/chroma-core/chroma/releases.atom' }, (data) => {
    const $ = cheerio.load(data, { xmlMode: true });
    const items = [];
    $('entry').slice(0, 2).each((i, el) => {
      const item = $(el);
      const title = item.find('title').first().text().trim();
      const link = item.find('link').attr('href') || '';
      const summary = (item.find('content').first().text() || '')
        .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 240);
      if (title) items.push({ source: 'ChromaDB', title, link, summary });
    });
    return items;
  });
  results.push(...chroma.items);
  health.push(chroma.health);

  // SQLite news
  const sqlite = await scrapeFeedItems({ name: 'SQLite', url: 'https://www.sqlite.org/news.html' }, (data) => {
    const $ = cheerio.load(data);
    const firstH3 = $('h3').first();
    const title = firstH3.text().replace(/\s+/g, ' ').trim();
    const items = [];
    if (title) {
      const summary = firstH3.nextUntil('h3').text().replace(/\s+/g, ' ').trim().slice(0, 240);
      items.push({ source: 'SQLite', title, link: 'https://www.sqlite.org/news.html', summary });
    }
    return items;
  });
  results.push(...sqlite.items);
  health.push(sqlite.health);

  return { items: results, health };
}

async function scrapeAll() {
  console.log('Scraping sources...');

  const [hackerNews, githubTrending, podcasts, reddit, aiBlogs, dataTools] = await Promise.all([
    scrapeSource('Hacker News', scrapeHackerNews),
    scrapeSource('GitHub Trending', scrapeGitHubTrending),
    scrapePodcasts(),
    scrapeReddit(),
    scrapeAIBlogs(),
    scrapeDataTools(),
  ]);

  return {
    hackerNews: hackerNews.items,
    githubTrending: githubTrending.items,
    podcasts: podcasts.items,
    reddit: reddit.items,
    aiBlogs: aiBlogs.items,
    dataTools: dataTools.items,
    sourceHealth: [
      hackerNews.health,
      githubTrending.health,
      ...podcasts.health,
      ...reddit.health,
      ...aiBlogs.health,
      ...dataTools.health,
    ],
  };
}

module.exports = { scrapeAll };
