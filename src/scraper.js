const axios = require('axios');
const cheerio = require('cheerio');

let redditAccessToken;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeHackerNews() {
  try {
    const { data } = await axios.get(
      'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=25',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 },
    );
    const items = (data.hits || [])
      .map((hit) => ({
        title: (hit.title || '').trim(),
        // 自帖（Ask HN 等）没有外链，用讨论页补上，消灭相对链接和 '#'
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        points: hit.points || 0,
        comments: hit.num_comments || 0,
        commentsUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        pubDate: hit.created_at || '',
      }))
      .filter((item) => item.title);
    if (!items.length) throw new Error('Algolia returned no front_page hits');
    return items;
  } catch (apiError) {
    return scrapeHackerNewsHtml(apiError);
  }
}

// 兜底：Algolia 挂了退回抓首页 HTML（没有分数/讨论链接，但保住基本盘）
async function scrapeHackerNewsHtml(apiError) {
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
      if (text && href) {
        items.push({
          title: text,
          url: href.startsWith('http') ? href : `https://news.ycombinator.com/${href}`,
        });
      }
    });

    if (!items.length) throw new Error('front page returned no parsable items');
    return items;
  } catch (e) {
    throw new Error(`Hacker News failed: API ${apiError.message}; HTML ${e.message}`);
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

    // 抓满 25 条交给过滤层选优（老版只抓 5 条，AI 命中率看天吃饭）
    $('article.Box-row').each((i, el) => {
      if (i >= 25) return false;
      const repoEl = $(el).find('h2 a');
      const name = repoEl.text().replace(/\s+/g, '').trim();
      const href = repoEl.attr('href');
      const description = $(el).find('p').text().trim();
      // 总星数和今日新增是两个不同元素：总星在 /stargazers 链接里，今日新增在右下角 float 元素里
      const stars = $(el).find(`a[href="${href}/stargazers"]`).text().trim();
      const starsToday = $(el).find('.float-sm-right').text().trim();
      if (name && href) {
        items.push({
          name,
          url: `https://github.com${href}`,
          description: description || '',
          stars: stars || '',
          starsToday: starsToday || '',
        });
      }
    });

    if (!items.length) throw new Error('trending page returned no parsable repos');
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
    // 读者要的是讨论页，不是帖子指向的裸图/外链（i.redd.it 的 jpeg 点开毫无上下文）
    const permalink = post.attr('data-permalink') || post.find('a.comments').first().attr('href') || '';
    let url = permalink || titleEl.attr('href') || '';
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
      if (!title) return [];
      // 播客低频更新：feed 第一条可能是几周前的旧集，超 7 天不收（此前会连续多天重复推荐同一集）
      const ageDays = (Date.now() - Date.parse(pubDate)) / 86400000;
      if (Number.isFinite(ageDays) && ageDays > 7) return [];
      return [{ podcast: feed.name, title, link, description, pubDate }];
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
    { name: 'Qwen Blog', url: 'https://qwenlm.github.io/blog/index.xml', limit: 2 },
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
        const content = (item.find('content\\:encoded').first().text() || item.find('content').first().text() ||
          item.find('summary, description').first().text() || '').slice(0, 30000);
        // RSS 里现成的发布时间，以前白白扔掉，现在供新鲜度衰减用
        const pubDate = item.find('pubDate, published, updated').first().text().trim();
        if (title) {
          items.push({ author: feed.name, title, link, summary, content, pubDate });
        }
      });
      if (!items.length) throw new Error(`${feed.name} feed returned no parsable entries`);
      return items;
    });
    results.push(...result.items);
    health.push(result.health);
  }

  const extraSources = [
    ['The Batch (deeplearning.ai)', scrapeTheBatch],
    ['Anthropic News', scrapeAnthropicNews],
    ['HF Daily Papers', scrapeHFDailyPapers],
  ];
  for (const [name, fn] of extraSources) {
    const result = await scrapeSource(name, fn);
    results.push(...result.items);
    health.push(result.health);
  }

  return { items: results, health };
}

// Anthropic 官网没有 RSS；置顶文章可能比列表旧，按发布日期取最新。
async function scrapeAnthropicNews() {
  const { data } = await axios.get('https://www.anthropic.com/news', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000,
  });
  return parseAnthropicNews(data);
}

function parseAnthropicNews(html) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];
  $('a[href^="/news/"]').each((i, el) => {
    const href = $(el).attr('href');
    const title = cleanText($(el).find('h2, h3, h4').first().text() || $(el).text());
    if (!href || seen.has(href) || !title || title.length < 15) return;
    seen.add(href);
    items.push({
      author: 'Anthropic News',
      title: title.slice(0, 200),
      link: `https://www.anthropic.com${href}`,
      summary: cleanText($(el).find('p').first().text()).slice(0, 300),
      pubDate: $(el).find('time').first().attr('datetime') || $(el).find('time').first().text().trim(),
    });
  });
  if (!items.length) throw new Error('Anthropic news page returned no parsable articles');
  return items.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0)).slice(0, 3);
}

// Hugging Face 每日论文榜：按社区 upvotes 取前 3，AI 研究一手信号
async function scrapeHFDailyPapers() {
  const { data } = await axios.get('https://huggingface.co/api/daily_papers?limit=30', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000,
  });
  const items = (Array.isArray(data) ? data : [])
    .map((entry) => entry.paper || {})
    .filter((paper) => paper.id && paper.title)
    .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
    .slice(0, 3)
    .map((paper) => ({
      author: 'HF Daily Papers',
      title: cleanText(paper.title).slice(0, 200),
      link: `https://huggingface.co/papers/${paper.id}`,
      summary: cleanText(paper.summary || '').slice(0, 300),
      pubDate: paper.publishedAt || '',
    }));
  if (!items.length) throw new Error('HF daily_papers API returned no papers');
  return items;
}

function cleanText(value) {
  return String(value)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function scrapeAll() {
  console.log('Scraping sources...');

  const [hackerNews, githubTrending, podcasts, reddit, aiBlogs] = await Promise.all([
    scrapeSource('Hacker News', scrapeHackerNews),
    scrapeSource('GitHub Trending', scrapeGitHubTrending),
    scrapePodcasts(),
    scrapeReddit(),
    scrapeAIBlogs(),
  ]);

  return {
    hackerNews: hackerNews.items,
    githubTrending: githubTrending.items,
    podcasts: podcasts.items,
    reddit: reddit.items,
    aiBlogs: aiBlogs.items,
    sourceHealth: [
      hackerNews.health,
      githubTrending.health,
      ...podcasts.health,
      ...reddit.health,
      ...aiBlogs.health,
    ],
  };
}

module.exports = {
  scrapeAll,
  hasRedditOAuthConfig,
  redditUserAgent,
  parseAnthropicNews,
};
