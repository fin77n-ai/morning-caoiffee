const { optimizeContent } = require('../src/optimizeContent');

const sampleData = {
  hackerNews: [
    { title: 'OpenAI launches new coding agent workflow', url: 'https://example.com/openai-agent' },
    { title: 'A tiny SQLite trick for analytics', url: 'https://example.com/sqlite' },
    { title: 'New multimodal benchmark for reasoning models', url: 'https://example.com/benchmark' },
    { title: 'Vector database release notes', url: 'https://example.com/vector-db' },
  ],
  githubTrending: [
    {
      name: 'agent-lab',
      url: 'https://github.com/example/agent-lab',
      description: 'Open-source framework for browser coding agents',
      stars: '12,345',
    },
    {
      name: 'rag-index-kit',
      url: 'https://github.com/example/rag-index-kit',
      description: 'Retrieval toolkit for vector search and embeddings',
      stars: '2,100',
    },
  ],
  reddit: [
    {
      subreddit: 'LocalLLaMA',
      title: 'Open weights model beats larger closed model in coding eval',
      url: 'https://reddit.com/r/LocalLLaMA/example1',
      score: 950,
      comments: 180,
    },
    {
      subreddit: 'MachineLearning',
      title: 'Paper discussion: synthetic data for reasoning',
      url: 'https://reddit.com/r/MachineLearning/example2',
      score: 420,
      comments: 90,
    },
  ],
  aiBlogs: [
    {
      author: 'OpenAI News',
      title: 'New tools for enterprise AI agents',
      link: 'https://example.com/enterprise-agents',
      summary: 'A product launch focused on agent workflows and developer tooling.',
    },
    {
      author: 'Google DeepMind Blog',
      title: 'Research update on multimodal reasoning',
      link: 'https://example.com/multimodal',
      summary: 'A research post about model capability and evaluation.',
    },
  ],
  dataTools: [
    {
      source: 'DuckDB',
      title: 'DuckDB release improves SQL analytics',
      link: 'https://example.com/duckdb',
      summary: 'New database features for local analytics.',
    },
    {
      source: 'ChromaDB',
      title: 'Chroma release adds embedding pipeline improvements',
      link: 'https://example.com/chroma',
      summary: 'Vector search updates for RAG workflows.',
    },
  ],
  podcasts: [
    {
      podcast: 'Dwarkesh Podcast',
      title: 'Conversation about AI agents and research taste',
      link: 'https://example.com/podcast',
      description: 'A long-form conversation about agents and model progress.',
      pubDate: 'Tue, 09 Jun 2026 00:00:00 GMT',
    },
  ],
};

function printGroup(name, items) {
  console.log(`\n${name}`);
  for (const item of items) {
    const title = item.title || item.name;
    console.log(
      `  #${item.rank} [${item.category}] score=${item.optimizationScore} ${title}`
    );
    console.log(`     ${item.reason}`);
  }
}

const optimized = optimizeContent(sampleData);

console.log('Optimization profile:', optimized.optimization.profileVersion);
console.log('Input counts:', optimized.optimization.inputCounts);
console.log('Output counts:', optimized.optimization.outputCounts);

printGroup('Hacker News', optimized.hackerNews);
printGroup('GitHub Trending', optimized.githubTrending);
printGroup('Reddit', optimized.reddit);
printGroup('AI Blogs', optimized.aiBlogs);
printGroup('Data Tools', optimized.dataTools);
printGroup('Podcasts', optimized.podcasts);
