# Task Breakdown

## Task List

### T1

- Goal: Add a content profile.
- Dependencies: Existing topic preferences.
- Scope: `src/contentProfile.js`.
- Verification: `node --check src/contentProfile.js`.
- Status: `done`

### T2

- Goal: Add `optimizeContent(data, profile)`.
- Dependencies: T1.
- Scope: new `src/optimizeContent.js`.
- Verification: `npm run preview:optimized` returns ranked, deduped, capped groups compatible with `summarize(data)`.
- Status: `done`

### T3

- Goal: Wire optimizer into daily flow.
- Dependencies: T2.
- Scope: `src/index.js`.
- Verification: `node --check src/index.js` and sample dry-run path.
- Status: `done`

### T4

- Goal: Update summarization prompt to respect optimized data.
- Dependencies: T2.
- Scope: `src/summarize.js`.
- Verification: Prompt no longer carries all ranking responsibility and still preserves HTML fragment constraints.
- Status: `done`

### T5

- Goal: Add a local dry-run or test fixture.
- Dependencies: T2.
- Scope: `scripts/preview-optimized-content.js` and `package.json`.
- Verification: `npm run preview:optimized` runs without API or Gmail secrets.
- Status: `done`

### T6

- Goal: Consider persistent learning later.
- Dependencies: successful V0.
- Scope: no code in first version.
- Verification: only proceed if user explicitly wants feedback-based personalization.
- Status: `later`
