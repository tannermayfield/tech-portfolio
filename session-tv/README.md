# Session TV

The existing vanilla JavaScript TV workspace is preserved: channel knobs, class assignments, skills, SQL/Python/JavaScript/HTML editors, project sprints, study timers, learning logs, settings, and written teach-backs.

## Run

Use Node 24.15+ (or Node 22.22.2+) and run `npm ci`, then `npm start`. The original `http://127.0.0.1:4173/` origin retains the original local workspace for safe backup/export. `localhost` is a separate browser origin. Hosted `/session-tv/` always starts in the isolated fictional demo unless signed in.

The portfolio includes a deployable snapshot of this source in `tech-portfolio/session-tv`. After editing this standalone folder, run `node tech-portfolio/scripts/sync-session-tv.mjs` from Projects, then build/test the portfolio. Only `public` is published. Credentials, backups, tests and companion files are excluded from the Pages artifact.

## Demo and private workspace

The public preview is read-only. It loads a deliberately published static snapshot and keeps navigation state in memory; old editable demo storage is ignored. Record writes, editing controls and AI actions are blocked. It never reads original local data or private cloud records. Sample records remain until a reviewed snapshot of the corrected Supabase records is published. See [simple setup steps](docs/NEXT-STEPS.md). Ordinary navigation uses the existing hashes, so refresh/back/forward work on GitHub Pages without a server rewrite.

The private workspace uses email and password through Supabase Auth. Private app data and drafts load from owner-scoped Supabase tables. Signing out clears private memory and reloads the hosted preview.

See [cloud setup](docs/CLOUD.md) and [simple next steps](docs/NEXT-STEPS.md). Enter correct records manually after signing in. The old local data is incorrect and will not be migrated or published; Settings no longer offers backup/import controls.

## AI Connections

Settings → Session Preferences → AI Connection manages the local Codex companion and optional ChatGPT plan-backed general chat. ChatGPT authorization and inference run on your computer using the official local-app OAuth flow; the website receives no OpenAI credentials. Continue with ChatGPT requires your own browser consent. Use included plan usage and leave credit use disabled in ChatGPT Settings → Usage; there is no API-key or paid fallback. See [AI setup](docs/AI.md).

Project Plan and Apply use GPT-6 Luna at Light effort. Work uses that model and opens at Medium, with Light, Medium, High and Extra high offered when supported. Every turn sends the selected model and effort explicitly.

The old `server.mjs` Claude API proxy remains for compatibility with the original explicit local API-key setup/tests. The new frontend never calls it, including when an environment key is present. It is not shipped to GitHub Pages. No ChatGPT/Claude tokens belong in browser storage or project configuration.

## Checks

`npm run check` validates JavaScript syntax and static references. `npm test` covers original app behavior, storage isolation, cloud client/auth/import, companion authorization and protocol restrictions. PostgreSQL integration fixtures are in `supabase/tests/rls.sql`; they were executed against PGlite as documented in `docs/CLOUD.md`. The portfolio additionally runs type checking, production export and browser tests against the combined static output.

External editor/runtime CDN downloads still require internet access. The app and data features work without a companion. Supabase free-tier limits and email delivery constraints must be monitored; no paid service was activated.
