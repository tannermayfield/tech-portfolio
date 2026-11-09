# Session TV

The existing vanilla JavaScript TV workspace is preserved: channel knobs, class assignments, skills, SQL/Python/JavaScript/HTML editors, project sprints, study timers, learning logs, settings, and written teach-backs.

## Run

Use Node 24.15+ (or Node 22.22.2+) and run `npm ci`, then `npm start`. The original `http://127.0.0.1:4173/` origin retains the original local workspace for safe backup/export. `localhost` is a separate browser origin. Hosted `/session-tv/` always starts in the isolated fictional demo unless signed in.

The portfolio includes a deployable snapshot of this source in `tech-portfolio/session-tv`. After editing this standalone folder, run `node tech-portfolio/scripts/sync-session-tv.mjs` from Projects, then build/test the portfolio. Only `public` is published. Credentials, backups, tests and companion files are excluded from the Pages artifact.

## Demo and private workspace

The public preview is read-only. It loads a deliberately published static snapshot and keeps navigation state in memory; old editable demo storage is ignored. Record writes, editing controls and AI actions are blocked. It never reads original local data or private cloud records. Sample records remain until a reviewed snapshot of the corrected Supabase records is published. See [simple setup steps](docs/NEXT-STEPS.md). Ordinary navigation uses the existing hashes, so refresh/back/forward work on GitHub Pages without a server rewrite.

My Workspace supports username/password and email/password sign-in through Supabase Auth. Username aliases require the additional migration and username-login Edge Function. See the current account setup guide; actual passwords stay private. Private app data and drafts load from owner-scoped Supabase tables; only the Supabase account session is browser-persisted separately. Signing out clears private memory and reloads the hosted preview.

See [cloud setup](docs/CLOUD.md) and [simple next steps](docs/NEXT-STEPS.md). Enter correct records manually after signing in. The old local data is incorrect and will not be migrated or published; Settings no longer offers backup/import controls.

## AI Connections

Settings → AI Connections replaces Local Setup. ChatGPT general chat is unavailable pending confirmation/admission for this hosted/local architecture. No fake connected status or paid fallback is enabled. See [AI and local Codex setup](docs/AI.md). The companion requires owner authentication, explicit pairing, selected project directories and an enforceable OS sandbox. Additional permission requests are declined; run reviewed actions separately in your terminal. The current Windows sandbox probe refused unsafe execution; no coding turn or inference was run.

The old `server.mjs` Claude API proxy remains for compatibility with the original explicit local API-key setup/tests. The new frontend never calls it, including when an environment key is present. It is not shipped to GitHub Pages. No ChatGPT/Claude tokens belong in browser storage or project configuration.

## Checks

`npm run check` validates JavaScript syntax and static references. `npm test` covers original app behavior, storage isolation, cloud client/auth/import, companion authorization and protocol restrictions. PostgreSQL integration fixtures are in `supabase/tests/rls.sql`; they were executed against PGlite as documented in `docs/CLOUD.md`. The portfolio additionally runs type checking, production export and browser tests against the combined static output.

External editor/runtime CDN downloads still require internet access. The app and data features work without a companion. Supabase free-tier limits and email delivery constraints must be monitored; no paid service was activated.
