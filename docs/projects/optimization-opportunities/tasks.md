# Task Breakdown

## Recommended Next Work

### T1: Add source health reporting

- Goal: Stop losing failed sources silently.
- Scope: `src/scraper.js`, optional `src/sourceHealth.js`.
- Verification: `npm run dry-run` reports failed sources without killing the digest.
- Status: `done`

### T2: Add a safe full dry-run mode

- Goal: Preview scrape + optimize + summarize inputs without sending email.
- Scope: `src/index.js` or a new script under `scripts/`.
- Verification: `npm run dry-run` runs without Gmail or DeepSeek secrets and prints source health, counts, and prompt preview.
- Status: `done`

### T3: Extract the prompt template

- Goal: Make `src/summarize.js` easier to edit and review.
- Scope: move prompt construction into `src/promptTemplate.js` or `src/buildPrompt.js`.
- Verification: `node --check`, plus a prompt snapshot or preview output.
- Status: `partial`

### T4: Add optimizer fixture tests

- Goal: Make content weighting changes safe.
- Scope: `scripts/preview-optimized-content.js` or a lightweight Node test script.
- Verification: fixed sample input produces expected top categories and counts.
- Status: `recommended`

### T5: Add same-day and recent-history dedupe

- Goal: Avoid repeating the same terms/stories across days.
- Scope: small history file or GitHub Actions artifact/cache.
- Verification: repeated item is lowered or removed in a sample run.
- Status: `later`

### T6: Expand source mix toward applied AI

- Goal: Improve real-world product/workflow coverage.
- Scope: `src/scraper.js`.
- Verification: scrape count sanity check and optimizer category distribution.
- Status: `later`
