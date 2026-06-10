# Architecture Decision Record

## Decision

- Start with a local pre-summarization ranking layer, not a new API or backend.
- Add dynamic optimization between `scrapeAll()` and `summarize(data)`.
- Keep the first version stateless or file-configured; postpone feedback-based learning until there is a real feedback channel.

## Context

- Current flow is linear: `src/index.js` calls `scrapeAll()`, then `summarize(data)`, then wraps and sends email.
- `src/summarize.js` currently carries most editorial weighting inside the prompt.
- `src/scraper.js` returns grouped source data, but items do not yet have normalized categories, scores, or dedupe metadata.
- GitHub Actions runners do not preserve local state between runs unless the project deliberately stores state elsewhere.

## Options Considered

### Option 1: Prompt-only dynamic optimization

- Summary: Keep data shape unchanged and add instructions in `src/summarize.js` telling DeepSeek to dynamically choose better stories.
- Pros: Smallest code change.
- Cons: Hard to test, hard to control, can drift, and gives the model too much hidden editorial power.

### Option 2: Local ranking layer before summarization

- Summary: Add a small module that normalizes, tags, scores, dedupes, and limits items before the prompt.
- Pros: Testable, simple, no new runtime service, keeps prompt smaller and cleaner.
- Cons: Requires a new internal module and some scoring heuristics.

### Option 3: Feedback-learning system with persistent state

- Summary: Track user feedback or reading signals over time and adjust future digests.
- Pros: True long-term personalization.
- Cons: Needs durable storage and a feedback mechanism; too much for the first useful version.

## Chosen Approach

- Choose Option 2 for the first implementation.
- Keep Option 3 as a later phase only if the user wants explicit personalization.

## API Decision

- No HTTP API is needed for the first version.
- A small internal module boundary is justified:
  - `src/optimizeContent.js` can consume scraped data and return optimized digest data.
  - `src/index.js` can call it between scraping and summarizing.

## Decoupling Decision

- Decoupling is justified at the content-selection boundary because source scraping and editorial ranking change for different reasons.
- Do not split into a large plugin system; a single internal optimizer module is enough.

## Consequences

- `src/summarize.js` can stay focused on rendering editorial voice and HTML rules.
- `src/scraper.js` can stay focused on collection.
- Dynamic behavior becomes testable with sample data.
- Future persistent learning can be added without rewriting the mailer or template.
