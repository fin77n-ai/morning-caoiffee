# Implementation Plan

## Overview

- Yes, the repo can implement dynamic morning digest optimization.
- The smallest credible version is a pre-summarization content optimizer:
  - normalize incoming items
  - classify topics with deterministic keywords
  - score items by source, topic, freshness, and preference weights
  - dedupe repeated or near-identical items
  - cap each section before sending data to DeepSeek

## Proposed First Version

- Add `src/optimizeContent.js`.
- Optionally add `src/contentProfile.js` or `config/content-profile.json`.
- Update `src/index.js`:
  - `const rawData = await scrapeAll();`
  - `const optimizedData = optimizeContent(rawData);`
  - `const contentHtml = await summarize(optimizedData);`
- Lightly update `src/summarize.js` prompt so it knows data was pre-ranked and should not resurrect low-priority topics.

## Modules and Responsibilities

- `src/scraper.js`: collect raw source items.
- `src/optimizeContent.js`: rank, dedupe, tag, and cap content.
- `src/summarize.js`: turn optimized input into the final HTML fragment.
- `src/template.js`: no change.
- `src/mailer.js`: no change.
- `.github/workflows/daily-digest.yml`: no change for first version.

## Scoring Inputs

- Topic weights:
  - applied AI/product/workflows
  - agents/coding tools
  - frontier models/research
  - open-source/dev tools
  - RAG/data tooling
- Source weights:
  - AI lab blogs and reputable research/product sources get stable weight.
  - Reddit and HN get signal boosts from score/comments/title keywords.
  - Data tooling stays capped unless strongly relevant.
- Repetition controls:
  - V0 can dedupe within the same day.
  - V1 can add a small history file if durable state is desired.

## Interfaces and Boundaries

- `optimizeContent(data, profile)` should be an internal function, not an HTTP API.
- Input shape should match current `scrapeAll()` output.
- Output shape should remain compatible with `summarize(data)` to keep the change small.

## Risks

- Risk: Heuristic ranking may bury surprisingly interesting stories.
- Mitigation: keep a "wildcard" slot for high-signal oddities.

- Risk: Static keyword scoring becomes stale.
- Mitigation: keep profile weights simple and easy to edit.

- Risk: The LLM ignores rankings.
- Mitigation: pass rank/category metadata into the prompt and explicitly tell it to respect ranked input.

- Risk: Persistent learning gets heavy.
- Mitigation: do not add feedback storage in V0.

## Verification Strategy

- Add a focused unit-like script or test fixture for `optimizeContent()`.
- Run `node --check` on changed files.
- Run optimizer against sample data and inspect ranked output.
- If secrets are available later, run a dry-run mode that prints optimized data without sending email.
