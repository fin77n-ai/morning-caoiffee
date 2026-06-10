const contentProfile = {
  version: '2026-06-10-v1',
  topics: {
    appliedAI: {
      label: 'applied AI / product / workflows',
      weight: 1.45,
      keywords: [
        'agent', 'agents', 'workflow', 'automation', 'product', 'app', 'apps',
        'enterprise', 'customer', 'deployment', 'launch', 'assistant',
        'coding', 'developer', 'devtools', 'copilot', 'browser', 'desktop',
      ],
    },
    frontierModels: {
      label: 'frontier models / research',
      weight: 1.35,
      keywords: [
        'model', 'models', 'llm', 'reasoning', 'multimodal', 'vision',
        'audio', 'video', 'benchmark', 'eval', 'inference', 'training',
        'openai', 'anthropic', 'deepmind', 'google', 'meta', 'qwen',
      ],
    },
    openSource: {
      label: 'open-source / developer tools',
      weight: 1.2,
      keywords: [
        'open source', 'open-source', 'github', 'repo', 'library', 'framework',
        'sdk', 'cli', 'toolkit', 'mcp', 'self-hosted', 'local',
      ],
    },
    safetyEvals: {
      label: 'safety / evals / policy',
      weight: 1.1,
      keywords: [
        'safety', 'alignment', 'eval', 'evals', 'policy', 'governance',
        'security', 'privacy', 'risk', 'audit',
      ],
    },
    ragData: {
      label: 'RAG / data tooling',
      weight: 0.78,
      keywords: [
        'rag', 'retrieval', 'vector', 'embedding', 'embeddings', 'database',
        'duckdb', 'sqlite', 'chroma', 'lancedb', 'postgres', 'sql',
      ],
    },
  },
  sourceWeights: {
    hackerNews: 1,
    githubTrending: 1.1,
    reddit: 0.95,
    aiBlogs: 1.25,
    dataTools: 0.78,
    podcasts: 0.9,
  },
  limits: {
    hackerNews: 10,
    githubTrending: 4,
    reddit: 6,
    aiBlogs: 8,
    dataTools: 3,
    podcasts: 2,
  },
};

module.exports = { contentProfile };
