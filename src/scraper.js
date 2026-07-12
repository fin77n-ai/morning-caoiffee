const axios = require('axios');
const cheerio = require('cheerio');

let redditAccessToken;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
  if (!hasRedditOAuthConfig()) {
    try {
      const items = await scrapeRedditRssSubreddit(sub);
      return {
        items,
        health: { source: `Reddit r/${sub} RSS`, status: 'ok', count: items.length },
      };
    } catch (rssError) {
      try {
        const items = await scrapeRedditOldSubreddit(sub);
        return {
          items,
          health: { source: `Reddit r/${sub} old.reddit`, status: 'ok', count: items.length },
        };
      } catch (oldError) {
        return {
          items: [],
          health: {
            source: `Reddit r/${sub}`,
            status: 'failed',
            count: 0,
            error: `RSS fallback failed: ${rssError.message}; old.reddit fallback failed: ${oldError.message}`,
          },
        };
      }
    }
  }

  try {
    const data = await fetchRedditListing(sub);
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
  } catch (jsonError) {
    try {
      const items = await scrapeRedditRssSubreddit(sub);
      return {
        items,
        health: { source: `Reddit r/${sub} RSS`, status: 'ok', count: items.length },
      };
    } catch (rssError) {
      try {
        const items = await scrapeRedditOldSubreddit(sub);
        return {
          items,
          health: { source: `Reddit r/${sub} old.reddit`, status: 'ok', count: items.length },
        };
      } catch (oldError) {
        return {
          items: [],
          health: {
            source: `Reddit r/${sub}`,
            status: 'failed',
            count: 0,
            error: `${jsonError.message}; RSS fallback failed: ${rssError.message}; old.reddit fallback failed: ${oldError.message}`,
          },
        };
      }
    }
  }
}

async function scrapeRedditRssSubreddit(sub) {
  const { data } = await axios.get(`https://www.reddit.com/r/${sub}/.rss`, {
    headers: { 'User-Agent': redditUserAgent() },
    timeout: 10000,
  });
  const $ = cheerio.load(data, { xmlMode: true });
  const items = [];

  $('entry').slice(0, 3).each((i, el) => {
    const entry = $(el);
    const title = entry.find('title').first().text().trim();
    const url = entry.find('link').first().attr('href') || '';
    const summary = cleanText(entry.find('content').first().text()).slice(0, 240);
    if (title && url) {
      items.push({
        subreddit: sub,
        title,
        url,
        score: 0,
        comments: 0,
        summary,
      });
    }
  });

  if (!items.length) {
    throw new Error('No RSS entries found');
  }

  return items;
}

async function scrapeRedditOldSubreddit(sub) {
  const { data } = await axios.get(`https://old.reddit.com/r/${sub}/hot/`, {
    headers: { 'User-Agent': redditUserAgent() },
    timeout: 10000,
  });
  const $ = cheerio.load(data);
  const items = [];

  $('.thing').slice(0, 8).each((i, el) => {
    const post = $(el);
    if (post.hasClass('stickied')) return;

    const titleEl = post.find('p.title a.title').first();
    const title = titleEl.text().trim();
    let url = titleEl.attr('href') || '';
    const commentsText = post.find('a.comments').first().text();
    const comments = Number((commentsText.match(/\d+/) || ['0'])[0]);
    const scoreText = post.find('.score.unvoted').first().attr('title')
      || post.find('.score.unvoted').first().text();
    const score = Number((scoreText.match(/\d+/) || ['0'])[0]);

    if (url.startsWith('/')) url = `https://old.reddit.com${url}`;
    if (title && url) {
      items.push({ subreddit: sub, title, url, score, comments });
    }
  });

  if (!items.length) {
    throw new Error('No old.reddit posts found');
  }

  return items.slice(0, 3);
}

async function fetchRedditListing(sub) {
  const headers = { 'User-Agent': redditUserAgent() };

  if (hasRedditOAuthConfig()) {
    const token = await getRedditAccessToken();
    const { data } = await axios.get(`https://oauth.reddit.com/r/${sub}/hot?limit=3`, {
      headers: { ...headers, Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    return data;
  }

  const { data } = await axios.get(`https://www.reddit.com/r/${sub}/hot.json?limit=3`, {
    headers,
    timeout: 10000,
  });
  return data;
}

async function getRedditAccessToken() {
  if (redditAccessToken) return redditAccessToken;

  const params = new URLSearchParams({ grant_type: 'client_credentials' });
  const { data } = await axios.post('https://www.reddit.com/api/v1/access_token', params, {
    auth: {
      username: process.env.REDDIT_CLIENT_ID,
      password: process.env.REDDIT_CLIENT_SECRET,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': redditUserAgent(),
    },
    timeout: 10000,
  });

  redditAccessToken = data.access_token;
  return redditAccessToken;
}

function hasRedditOAuthConfig(env = process.env) {
  return Boolean(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET);
}

function redditUserAgent(env = process.env) {
  return env.REDDIT_USER_AGENT || 'morning-caoiffee/1.0 by fin77n-ai';
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

  for (const [index, sub] of subreddits.entries()) {
    if (index > 0) await sleep(2500);
    const result = await scrapeRedditSubreddit(sub);
    results.push(...result.items);
    health.push(result.health);
  }

  return { items: results, health };
}

async function scrapeTheBatch() {
  const { data } = await axios.get('https://www.deeplearning.ai/the-batch', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000,
  });
  const $ = cheerio.load(data);
  const nextData = $('#__NEXT_DATA__').text();
  if (!nextData) return [];

  const pageData = JSON.parse(nextData);
  const posts = pageData.props?.pageProps?.posts || [];
  return posts.slice(0, 1).map((post) => ({
    author: 'The Batch (deeplearning.ai)',
    title: post.title,
    link: `https://www.deeplearning.ai/the-batch/${post.slug}`,
    summary: cleanText(post.excerpt || post.custom_excerpt || '').slice(0, 300),
    pubDate: post.published_at,
  })).filter((post) => post.title && post.link);
}

async function scrapeAIBlogs() {
  const feeds = [
    { name: 'OpenAI News', url: 'https://openai.com/news/rss.xml', limit: 2 },
    { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', limit: 2 },
    { name: 'Google DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml', limit: 2 },
    { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', limit: 2 },
    { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', limit: 1 },
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
        const summary = cleanText(item.find('summary, description, content').first().text() || '').slice(0, 300);
        if (title) {
          items.push({ author: feed.name, title, link, summary });
        }
      });
      return items;
    });
    results.push(...result.items);
    health.push(result.health);
  }

  const batch = await scrapeSource('The Batch (deeplearning.ai)', scrapeTheBatch);
  results.push(...batch.items);
  health.push(batch.health);

  return { items: results, health };
}

function cleanText(value) {
  return String(value)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

module.exports = {
  scrapeAll,
  hasRedditOAuthConfig,
  redditUserAgent,
};
