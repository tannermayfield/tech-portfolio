# Supabase private workspace

The hosted application defaults to fictional browser-local demo data. Signing in selects a separate private workspace. Supabase is the only cloud persistence service; the local AI companion is never involved in database access.

## Provisioning (account access required)

1. Create a free Supabase project in a suitable region. Keep the database password and service-role/secret keys outside this repository.
2. Apply `supabase/migrations/202611080001_session_tv.sql` with the Supabase SQL editor, or link the Supabase CLI to the project and run `supabase db push`.
3. Enable email authentication. Under Authentication → Email Templates → Magic Link, use the one-time-code template: `Your Session TV sign-in code is {{ .Token }}`. The application explicitly requests and verifies an email OTP; it does not depend on redirects or a callback route. Use the current code length configured by Supabase. Configure Site URL as `https://tannermayfield.dev/session-tv/` and add that URL to the redirect allowlist for future magic-link support. Configure production email delivery as needed; the built-in sender has restrictions and is intended for testing.
4. Put **only** the Supabase project URL and publishable key (or legacy `anon` key) into the portfolio GitHub Actions repository variables used by the build. Locally configure `window.SessionTVConfig.supabaseUrl` and `.supabasePublishableKey` in `public/js/config.js`. Never place a service-role key, database password, AI access token, or API key there.
5. Build and deploy the portfolio. Open My Workspace, request an email code, and enter it. Test sign-out, another browser, and a second account before importing personal information.

Authentication uses the documented Supabase Auth endpoints (`otp`, `verify`, `user`, `token?grant_type=refresh_token`, and `logout`) with the public project key. Access and refresh tokens are stored separately from application/demo/backup data in `sessiontv.auth.v1`. Tokens are verified against `/auth/v1/user`, refreshed before expiry, and removed on sign-out. Private application records and drafts are held in memory and hydrated from Supabase at startup. A page reload after OTP verification starts the artifact with the correct private preferences. Email OTP avoids storing callback credentials in a GitHub Pages URL and works across static routes without a server.

Each account is identified by the Supabase Auth UUID. Changing an email address does not change record ownership. A future approved OpenAI provider should link an identity to that existing Supabase user after verifying both sessions through a trusted backend/provider integration. Do not create a second account from an OpenAI email or treat OpenAI identity authorization as permission to use a ChatGPT plan. No nonfunctional OpenAI login control is included.

## Data model and compatibility

The existing artifact is a document-oriented application with five collections: `tasks`, `projects`, `sessions`, `state`, and `settings`. Browser `sb.*` keys additionally hold preferences, editor drafts, animation settings, session plans, and unfinished coaching turns. It has no separate SQLite or IndexedDB personal-data database. SQL.js is an in-browser exercise engine with fictional airline sample tables; its SQL exercises are editor drafts, not the personal-data source.

The migration creates these owner-scoped PostgreSQL tables:

| Table | Purpose |
| --- | --- |
| `stv_courses` | Class names extracted from assignment records |
| `stv_tasks` | Assignments, skills/progress, project tasks, deadlines and ordering |
| `stv_projects` | Project records and sprint history |
| `stv_sprints`, `stv_sprint_tasks` | Sprint milestones and task memberships |
| `stv_sessions` | Completed study sessions, time totals, teach-backs and feedback |
| `stv_workspace_state` | Current study session, allocation, task selection and active chat state |
| `stv_settings` | Playlist URLs and existing application settings |
| `stv_preferences` | Browser preferences, editor drafts and unfinished conversations |
| `stv_conversations`, `stv_messages` | Relational projection of saved skill-conversation threads and ordered messages |
| `stv_imports` | Verified import receipts and duplicate detection |

All rows have UUID primary keys, Auth ownership, timestamps and owner indexes. Legacy document IDs remain unique per owner and are returned to the existing frontend unchanged. Composite foreign keys enforce same-owner courses, projects, sprint memberships, and conversations. The original versioned document payloads remain lossless in JSONB so archived skills, old category names, study-session snapshots, arbitrary editor text, nested sprint metadata and fields from earlier exports are preserved. Typed relational projections support normal joins without rewriting the artifact's layered state model. Historical references to deleted tasks remain in their source payload rather than being dropped during import.

RLS is enabled on every private table. Only authenticated owners may select or modify their rows. RPCs are `security invoker`, explicitly reject missing authentication, and are not executable by anonymous clients. There is no administrator credential in the frontend. The client loads snapshots with `sessiontv_snapshot`, writes through `sessiontv_write`, and synchronizes `sb.*` keys through `sessiontv_preference`. Updates merge fields atomically on the server. Thirty-second foreground polling refreshes another device's updates; simultaneous edits to the same field or current-session document use last successful write. Writes are confirmed before the adapter publishes snapshots, and failed writes publish the last known state and surface an error. This is online persistence, not an offline editing queue.

## Safe import

First download a backup from the **original browser profile and original origin** (`localhost` and `127.0.0.1` are different origins). Source files cannot recover browser-only data. Keep the downloaded file and original browser data until verification is complete.

After signing into the configured destination, use Import into My Workspace and select the legacy Session TV JSON backup. `sessiontv_import` validates all collections and keys, runs the complete merge in a transaction, preserves legacy identifiers, verifies each imported record by reading it back, and returns a fingerprint receipt with `verified: true`. Identical imports return `alreadyImported: true`; unique owner/legacy-ID constraints prevent duplicate records. Existing records with different content abort the entire import instead of overwriting them. Export both workspaces and resolve the conflict before retrying. Preferences also conflict rather than overwrite.

Export the cloud workspace after import and compare counts and important records (assignments, projects, sprint memberships, skills, sessions, settings, editor drafts and conversation history) against the original backup. The source browser is never deleted or rewritten by cloud import. Download cloud exports periodically; the free tier is not a substitute for independent backups.

## Verification

Run `npm test` for the browser client tests. The cloud tests exercise empty configuration, email OTP requests, authenticated RPCs, rejection without local commit, and backup validation with simulated HTTP responses.

Run `psql <local-supabase-url> -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql` against an expendable local Supabase test project after applying the migration. It verifies two-user isolation, forged ownership rejection, anonymous RPC denial, sprint/task relationships, conversation extraction, verified import, duplicate import and conflict rollback; all fixtures roll back. The migration and this SQL test were also executed successfully using PGlite PostgreSQL with a minimal test Auth schema. This validates PostgreSQL behavior, not production Supabase account settings, email delivery, real-device authentication, or remote connectivity; those require the configured project.

## Cost and limits

Use Supabase's free plan initially and monitor database size, egress, monthly active users, email delivery limits and inactivity pausing. Limits and pricing can change; check [Supabase pricing](https://supabase.com/pricing) before enabling paid resources. Conversation history and editor drafts count toward database size. Browser-local demo traffic does not create database rows or authentication requests. Foreground polling uses database requests only while a private workspace is open. No AI API billing fallback exists in this data layer. Production email sending or larger database/storage needs may add costs; upgrades require an explicit account decision.

Official references: [passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [sessions](https://supabase.com/docs/guides/auth/sessions), and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

As checked on November 8, 2026, the [Supabase free plan](https://supabase.com/pricing) includes 500 MB of database space per project, 5 GB of egress, 1 GB of file storage and 50,000 monthly active users, with two active projects. Free projects can pause after one week of inactivity, and automatic database backups are not included. Keep independent exports. These limits can change; monitor the project dashboard before expanding use.
