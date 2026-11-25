# Email or Google sign-in

Open **Settings → Session Login → Login to Session**. The Session Login popup offers exactly two ways in:

- **Email address** and **Password** (with **Show/Hide**), then **Sign In**.
- **Continue with Google**.

There is no email code or magic-link template requirement for ordinary password sign-ins. Account confirmation and password recovery remain email/account-administration concerns.

## Required Supabase setup

1. Apply the files in `supabase/migrations` in filename order if they have not been applied (`supabase db push` applies all pending files). See [CLOUD.md](CLOUD.md).
2. Create your owner account with an email and password in **Supabase Authentication → Users**, or add a password to your existing account through a supported trusted account-management/recovery flow. Use the existing account UUID if there is already an account; do not create a duplicate. Confirm the email according to the project's authentication settings. Keep the password private; it is not needed in this chat.
3. For **Continue with Google**, enable the Google provider in Supabase and link Google to your existing account from **Account Settings**. See [Google sign-in setup](GOOGLE-ACCOUNT.md). Google sign-in only works on the hosted site, `https://tannermayfield.dev/session-tv/`.
4. Open the hosted app → **Settings → Session Login → Login to Session** and sign in with your email and password, or continue with Google.
5. Enter your correct courses, assignments, skills and projects through **Settings → My Database**. The incorrect local records are not imported or published. The public preview remains a separate read-only snapshot.

Base database setup is required to load the private workspace.

The repository still contains an earlier username sign-in (`supabase/migrations/202611090001_username_login.sql` and the `username-login` Edge Function, tested in `tests/username-login.test.mjs` and `supabase/tests/usernames.sql`). The app no longer offers it: the Edge Function does not need to be deployed, and the migration stays only because later migrations are ordered after it.

## Security and behavior

- Supabase Auth stores and verifies passwords. The app does not keep passwords in localStorage or its database.
- Email/password goes directly to the official Auth password endpoint. Google uses the Supabase OAuth flow with PKCE and returns to the hosted site.
- Account UUIDs, homework ownership, RLS, session refresh, sign-out and demo/agent restrictions remain unchanged. No new user is created by the email sign-in form.
- There is no public registration or password-reset form. The owner provisions the account and password through supported Supabase account-management tooling. A password-reset UI can be added separately with its authenticated callback flow; a reset-email button without that flow would be incomplete.
- Signing in does not enable ChatGPT/Codex. No paid AI fallback is configured.

## Testing and deployment status

Client behavior is tested with simulated Auth responses. No real password was submitted or owner account created by these tests. GitHub Pages publishes only `public/`; the SQL is applied in Supabase. No paid plan, email provider or API billing was enabled.

Official references: [password auth](https://supabase.com/docs/guides/auth/passwords), [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Settings, Preferences and exit

Settings starts with **Session Login**, **Preferences** and **Exit SessionTV**, then **Connections** (the ChatGPT, Codex and Canvas status), **Time Stats** and **My Database**.

**Preferences** opens one popup with tabs:

- **Appearance**: Auto/Light/Dark, **Screen static** On/Off (snow, rolling bars, interference lines and scanlines), **Color** Color/Black & white (the picture-tube grayscale filter) and **Channel cutscenes** On/Off. These work in the public preview too.
- **Sections**, **Voices**, **Apple Music**, **Canvas** and **AI Connections** (signed in only).
- **Coach**: the coach profile.

Screen static and Color replaced the single **TV Screen Effect** setting. A saved Off becomes static Off and Color; On becomes static On and Black & white. Preferences use the existing workspace storage and sync to Supabase for signed-in users. Exit SessionTV returns in the same tab to `https://tannermayfield.dev/#projects`.
