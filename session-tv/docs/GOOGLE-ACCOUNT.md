# Google sign-in setup

The website supports email/password and Google through the same Supabase account. Existing users should link Google from Account Settings to preserve their workspace.

1. In Google Cloud Console, select or create a project. Open Google Auth Platform and configure Branding and Audience. Add your own Google account as a test user if the app is in testing.
2. Create a Web application OAuth client under Clients. Add `https://tghzpzecxwerhwxoljkd.supabase.co/auth/v1/callback` as an authorized redirect URI.
3. In Supabase → Authentication → Sign In / Providers → Google, enable Google and save that client ID and client secret. Keep the secret in Supabase, never in website code.
4. In Authentication → URL Configuration, set the Site URL and add the redirect URL `https://tannermayfield.dev/session-tv/`.
5. In Authentication settings, enable Manual identity linking for the Account Settings → Link Google account action.
6. Refresh SessionTV. Sign into your existing account, open Account Settings, and link Google. Then test signing out and using Sign in with Google.

Permanent deletion uses the account-delete Edge Function. It validates the caller with Supabase Auth and deletes only that caller after typed confirmation. The private stv tables cascade from auth.users; files in computer folders are unaffected. No live account is deleted during deployment or testing.
