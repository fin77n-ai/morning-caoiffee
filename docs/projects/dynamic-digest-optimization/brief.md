# Project Brief

## Background

- `morning-caoiffee` currently builds a daily AI digest from fixed source groups and a large static summarization prompt.
- Content weighting is mostly encoded in `src/summarize.js`; source collection is mostly encoded in `src/scraper.js`.
- Prior repo memory says the project should stay broad-AI first, with RAG/data tooling as a minority topic unless the day's news genuinely warrants more.

## Goal

- Evaluate whether the repo can support dynamic optimization of morning digest content.
- Define a smallest useful version that improves content selection without overbuilding infrastructure.

## Working Definition

Dynamic optimization means the digest can adjust story selection and section emphasis based on:

- Fresh scraped items
- Topic/category relevance
- Source quality
- Repetition from recent days
- User preference weights
- Availability of strong stories per section

## Non-goals

- Do not build a web app, database, or user-facing feedback UI in the first version.
- Do not redesign the email template.
- Do not introduce a new HTTP API unless there is a real consumer.
- Do not let the LLM decide everything without deterministic ranking or guardrails.

## Constraints

- Time: first version should be a small repo change.
- Compatibility: keep CommonJS Node.js style.
- Stack: use existing Node.js dependencies unless a new dependency clearly pays for itself.
- Runtime: GitHub Actions runner is ephemeral, so durable learning requires explicit storage.
- Security: do not require new secrets for the first version.
- Maintenance: preserve the current simple daily pipeline.

## Acceptance Criteria

- [x] Determine whether dynamic content optimization is feasible.
- [x] Identify the smallest implementation path.
- [x] Decide whether a new API is needed.
- [x] Decide whether decoupling is justified.
- [x] Record risks and verification steps.

## Open Questions

- Should dynamic optimization be based only on daily content quality, or should it learn from user feedback over time?
- If user feedback is needed later, where should state live: GitHub artifact/cache, a checked-in file, external storage, or email-based replies?
