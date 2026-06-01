# Morning cAoIffee Agent Notes

## Project Shape

- `src/index.js` runs the daily flow: scrape data, summarize into HTML, wrap the email template, send via Gmail.
- `src/scraper.js` owns web/RSS collection for Hacker News, GitHub Trending, Reddit, AI blogs, podcasts, and selected data tooling.
- `src/summarize.js` owns the DeepSeek prompt and the final HTML fragment rules.
- `src/template.js` owns the dark email shell and inline email styling.
- `src/mailer.js` owns Gmail delivery.

## Working Rules

- Keep changes surgical. The report personality mostly lives in `src/summarize.js`; source mix mostly lives in `src/scraper.js`.
- Preserve inline styles in generated HTML instructions because email clients are fragile little drama queens.
- Prefer adding reliable RSS sources over scraping brittle web pages.
- Keep the digest broad-AI first: models, agents, multimodal AI, coding tools, evals/safety, product launches, research, open-source, and community debates.
- RAG/data tooling can appear when it is genuinely relevant, but should not dominate by default.
