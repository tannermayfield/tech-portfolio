# Session TV on GitHub Pages

The portfolio remains a Next.js static export at `/`. The existing Session TV frontend is vendored in `session-tv/public` and copied by `scripts/package-session-tv.mjs` into `out/session-tv/` after every `npm run build`. Its Node server and local AI companion are not hosted by Pages. No second domain is needed.

The deployment workflow `.github/workflows/deploy.yml` runs type checking and the combined build, uploads `out`, and deploys that single artifact to GitHub Pages. `public/CNAME` still supplies `tannermayfield.dev`; `.nojekyll` preserves Next's `_next` asset directory. Keep the repository's Pages source set to GitHub Actions.

Configure these **repository variables** under Settings → Secrets and variables → Actions → Variables before enabling the private cloud workspace:

- `SESSION_TV_SUPABASE_URL`: the Supabase project's public HTTPS URL.
- `SESSION_TV_SUPABASE_PUBLISHABLE_KEY`: its public publishable key (a legacy `anon` key is also accepted).

These values are public by design. The build writes them to `out/session-tv/js/config.js` as `window.SessionTVConfig`. Never use a service-role key or database password. The build rejects keys other than publishable/anon credentials. RLS and migrations must be applied in the Supabase project before using private data. The supplied public project configuration in session-tv/public/js/config.js is the default when variables are unset. Repository variables override it. Private sign-in requires the database migration and Auth email template.

Run `node scripts/sync-session-tv.mjs` from the portfolio folder to sync the standalone source before building. The script also accepts a source-folder argument. Never copy `.env`, `node_modules`, private backups, browser profiles, or credentials. Only `session-tv/public` is published.

Run `npm run typecheck`, `npm run test:e2e`, and `npm run build` before deploying. Inspect `out/session-tv/index.html`, its relative assets, and the generated public config. The authentic project preview lives at `public/images/session-tv.png`. Session TV owns its interface navigation below its base URL; do not add Next dynamic routes or server handlers for it.
