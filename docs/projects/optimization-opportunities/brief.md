# Project Brief

## Background

- `morning-caoiffee` now has a V0 local content optimizer between scraping and summarization.
- The repo still has several obvious quality and reliability opportunities around source health, prompt maintainability, testing, and safe dry-runs.

## Goal

- Identify the next optimization opportunities after dynamic content ranking.
- Prefer improvements that increase digest quality, reduce silent failures, or make changes easier to verify.

## Non-goals

- Do not implement additional changes in this analysis pass.
- Do not add a backend, database, or user-facing app.
- Do not redesign the visual email template.

## Constraints

- Time: prioritize small, high-leverage repo changes.
- Compatibility: keep CommonJS and the current GitHub Actions flow.
- Security: avoid running full email delivery without explicit intent.
- Maintenance: avoid turning a personal digest into a platform too early.

## Acceptance Criteria

- [x] Inspect current scraper, summarizer, optimizer, workflow, and package scripts.
- [x] Rank optimization opportunities by value and risk.
- [x] Capture file-level evidence.
- [x] Recommend a next implementation sequence.

## Open Questions

- Does the user want personalization over time, or just better daily editorial quality?
- Should future dry-runs render preview HTML locally, or only inspect optimized data?
