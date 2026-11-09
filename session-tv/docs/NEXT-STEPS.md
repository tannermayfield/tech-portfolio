# Finish Session TV setup

## Enter your records manually

The old local records are incorrect and must not be imported or published. Backup/import controls have been removed from Settings. The public preview remains read-only with clearly labeled sample records until a separate approved snapshot is published.

1. Apply `supabase/migrations/202611080001_session_tv.sql` once in your Supabase project's SQL Editor, if you have not already done so.
2. Complete email-code configuration below.
3. Open https://tannermayfield.dev/session-tv/, choose **My Workspace**, request a sign-in code and enter it.
4. In your signed-in private workspace, choose **Settings → My Database → Assignments, Skills or Projects → Add** and enter your correct records. These records belong to your Supabase account. Private changes are not automatically published to the public preview.

## Why the Magic Link template is locked

Supabase's [June 3, 2026 change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) prevents newer free-tier projects using its built-in email sender from editing authentication templates. The earlier instruction to simply edit the body missed this restriction. Custom SMTP unlocks template editing on the free plan; a paid Supabase upgrade is not required for that route.

1. Set up an external email provider and verify its sending address/domain as required by that provider. Obtain its SMTP host, port, username and password.
2. In your Supabase project's **Authentication → Email / SMTP Settings**, enable **Custom SMTP**, enter those SMTP details plus the sender name/address and save. Dashboard labels can vary; look for SMTP configuration under authentication email settings. SMTP credentials stay in Supabase, not browser code.
3. Open **Authentication → Emails → Templates → Magic Link**. Switch from preview to the body/code editor and use:

   ```html
   <p>Your Session TV sign-in code is {{ .Token }}</p>
   ```

4. Save, then request a fresh code from Session TV. An email already sent will not change.
5. Under **Authentication → URL Configuration**, set Site URL to `https://tannermayfield.dev/session-tv/` and add that URL to allowed redirects. The current code flow does not use a redirect, but this prepares later magic-link support.

[Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp) explains sender setup and built-in sender restrictions. The built-in sender is intended for testing, permits only project-team addresses and is rate-limited. External email-provider pricing/limits depend on that provider; no paid service has been activated by these code changes.

The app currently expects an emailed code. Keeping Supabase's default clickable-link email would require adding magic-link callback handling to the app; changing a dashboard URL alone does not implement that flow. Do not attempt to bypass Supabase's template restriction through its API.

## Optional AI

Cloud saving does not authorize ChatGPT or install the Codex companion. ChatGPT general chat remains unavailable pending integration authorization. Codex setup is documented in `docs/AI.md` and requires owner login, pairing and a supported local sandbox. Neither is needed for manually entered homework or cloud saving.
