# Finish Session TV setup

## 1. Keep a backup and send the public preview data

1. Start the original app with `npm start` from `C:\Users\tanne\Projects\Applications\session-tv`.
2. Open it in the browser/profile and exact address where your records already appear. `http://127.0.0.1:4173` and `http://localhost:4173` have different storage.
3. Choose **Settings → Workspace & AI → Open workspace → Backups & import → Download backup**.
4. Keep the JSON file. Attach it to this chat so the public snapshot can be prepared and reviewed. Your approved public scope is courses, assignments, deadlines, skills and projects. Chats, editor drafts, study-session notes and personal settings are excluded.

The public site is now read-only, but still shows sample records until the real export is supplied. Public records are visible/downloadable by anyone. Visitors cannot change your source data or invoke AI. The snapshot is a deliberate publication, not live access to your private Supabase account; later private changes do not automatically become public.

## 2. Turn on cloud saving

1. Open your Supabase project dashboard.
2. Open **SQL Editor → New query**. Paste the whole `supabase/migrations/202611080001_session_tv.sql` file and click **Run** once. Alternatively, connect the Supabase integration in ChatGPT so the migration can be applied for you. A public publishable key cannot install database tables.
3. Under **Authentication → Email Templates → Magic Link**, include `Your Session TV sign-in code is {{ .Token }}` in the email body and save. Supabase may label this under the authentication email settings.
4. Under **Authentication → URL Configuration**, set Site URL to `https://tannermayfield.dev/session-tv/` and add the same URL to allowed redirects. The current code login does not require a redirect, but this prepares future magic-link support.
5. Open the hosted app, click **My Workspace**, enter your email, request the code and enter the emailed code. If Supabase's default email sender refuses your address, configure a supported SMTP sender or use an account address allowed by your project's email settings.
6. In your signed-in workspace, expand **Backups & import**, import the JSON backup and wait for **Import verified**. Reload, check your records, then download a cloud backup. Keep the original backup and browser data.

These steps enable private cloud records. They do not authorize ChatGPT or install the Codex companion.

## 3. Optional AI

- **ChatGPT general chat:** No account-setup switch currently enables it in this app. The hosted/local integration still needs OpenAI eligibility/authorization work. The UI accurately shows it unavailable; no paid fallback runs.
- **Codex:** Follow `docs/AI.md` to create a dedicated local Codex profile, sign in with your ChatGPT account, configure the owner UUID and selected project directories, complete supported Windows sandbox setup, start the companion and pair it in **My Workspace → AI Connections**. This is a separate local setup step and is not needed for homework or cloud saving. The previous sandbox probe refused to run without adequate restrictions.

## Maintaining the public preview

After receiving the original backup, prepare a sanitized snapshot with `node scripts/publish-preview.mjs <backup.json> public/js/demo-data.js`. Review the output, sync the standalone source into the portfolio with its `scripts/sync-session-tv.mjs`, run checks/build, and deploy. Never copy the raw backup into `public` or commit it. The generated snapshot is an allowlist of approved fields and excludes all account ownership/credentials and private history.
