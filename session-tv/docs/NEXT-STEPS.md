# Username and password sign-in

Open Settings ? Session Login ? Open session login for **Username**, **Password**, **Show/Hide**, and **Sign In**. **Use email instead** switches to email/password for initial setup. There is no email code or magic-link template requirement for ordinary password sign-ins. Account confirmation and password recovery remain email/account-administration concerns.

## Required Supabase setup

1. Apply the base app migration `supabase/migrations/202611080001_session_tv.sql` if it has not been applied. Then apply `supabase/migrations/202611090001_username_login.sql` in the project's SQL Editor.
2. Deploy the `username-login` Supabase Edge Function. From this app's source folder, with an authorized Supabase CLI session:

   ```powershell
   supabase functions deploy username-login --project-ref tghzpzecxwerhwxoljkd
   ```

   `supabase/config.toml` disables the pre-login JWT check only for this function, because the person does not have a session yet. The handler checks the supplied password through Supabase Auth, restricts browser origin and applies database-backed attempt limits. Supabase-managed function secrets supply its URL, anon key and service-role key; no administrator secret belongs in browser code or the repository. The production allowed origin defaults to `https://tannermayfield.dev`; set `SESSIONTV_ALLOWED_ORIGIN` only for an intentionally different deployment.
3. Create your owner account with an email and password in **Supabase Authentication → Users**, or add a password to your existing account through a supported trusted account-management/recovery flow. Use the existing account UUID if there is already an account; do not create a duplicate just to get a username. Confirm the email according to the project's authentication settings. Keep the password private; it is not needed in this chat.
4. Open the hosted app → **My Workspace → Use email instead**. Sign in with your email and password.
5. In Session Login, enter your preferred username under **Your username** and click **Save username**. Next time you can sign in with that username and the same password. Username matching is case-insensitive; allowed names are 3–32 letters, numbers, dots, underscores and hyphens, starting with a letter or number.
6. Enter your correct courses, assignments, skills and projects through **Settings → My Database**. The incorrect local records are not imported or published. The public preview remains a separate read-only snapshot.

The username migration and Edge Function cannot be deployed using the frontend publishable key; they need an authorized Supabase account/CLI connection. Until that setup is complete, the form is available to view, but true username sign-in is not operational. Email/password sign-in uses Supabase Auth directly and requires an account with a password. Base database setup is still required to load the private workspace.

## Security and behavior

- Supabase Auth stores and verifies passwords. The app does not keep passwords in localStorage or its database.
- Email/password goes directly to the official Auth password endpoint. Username/password goes to the same project's Edge Function, which privately resolves the account email and forwards the password to Supabase Auth. Passwords and lookup emails are never logged or returned in an unauthenticated lookup response.
- `private.stv_usernames` is not an anonymous email directory. Users can get/change only their own username through owner-checked functions. The lookup RPC is executable only by the service role on the server.
- The login endpoint returns the same failure for unknown usernames and wrong passwords. Persistent limits allow 10 attempts per username and 30 per forwarded client-IP key in 10 minutes. The platform-provided forwarded-IP header is an additional signal; the username limit remains enforced independently. Limiter keys are HMACs, not stored raw emails/IP addresses. Supabase's own Auth limits also apply. No unrestricted lookup fallback exists.
- Account UUIDs, homework ownership, RLS, session refresh, sign-out and demo/agent restrictions remain unchanged. No new user is created by the sign-in form.
- This change does not include a public registration or password-reset form. The owner must provision the account/password through supported Supabase account-management tooling. A password-reset UI can be added separately with its authenticated callback flow; a reset-email button without that flow would be incomplete.
- Password sign-in does not enable ChatGPT/Codex. No paid AI fallback is configured.

## Testing and deployment status

Client/Edge Function behavior is tested with simulated Auth responses. PostgreSQL username ownership, private lookup restrictions, collision handling and limiter behavior are tested in `supabase/tests/usernames.sql`, executed using PGlite with a minimal Auth schema. No real password was submitted or owner account created by these tests. Live username login requires the Supabase setup above.

The function and SQL are included in repository source, but GitHub Pages publishes only `public/`. Function invocations count toward Supabase's limits; no paid plan, email provider or API billing was enabled.

Official references: [password auth](https://supabase.com/docs/guides/auth/passwords), [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets), [function authorization](https://supabase.com/docs/guides/functions/auth).

## Appearance and exit

Settings starts with three cards: **Appearance & Preferences**, **Session Login**, and **Exit SessionTV**. Appearance & Preferences opens a separate popup for Auto/Light/Dark, TV Screen Effect Off/On and Channel Cutscenes Off/On. Screen effects include the CRT scanline/reflection/noise layers and grayscale filter. Preferences use the existing workspace storage and sync to Supabase for signed-in users. The top status banner has been removed; sign-in is accessed from Settings. Exit SessionTV returns in the same tab to `https://tannermayfield.dev/#projects`.
