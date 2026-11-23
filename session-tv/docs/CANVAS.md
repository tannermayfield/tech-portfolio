# Connect BYU Canvas

Canvas assignments are read through your local Session Companion. The Canvas access token stays in the protected companion profile on your computer; it is never stored in GitHub Pages, browser storage or Supabase. Assignment records synced into your private workspace are saved to Supabase.

1. Sign into SessionTV and make sure the computer companion is paired.
2. In https://byu.instructure.com open Account → Settings → Approved Integrations → New Access Token.
3. Name the token SessionTV and choose an expiration date. Copy the generated token; do not paste it into chats or source files.
4. Open SessionTV Settings → Session Preferences → Open Full Preferences → Canvas. Paste the token into the protected input and connect.
5. Click Sync now. Classes and assignments appear in Homework Overview.

When enabled, automatic refresh runs while SessionTV is open, visible and your computer companion is connected. It does not run with the browser closed. Expired or revoked tokens require reconnecting. Sync only reads Canvas: marking tasks complete in SessionTV does not submit homework or change Canvas.

Imported assignments use stable Canvas identifiers. Repeated syncs update Canvas-owned fields while preserving SessionTV notes and skill links. Manually created assignments are kept separately. A failed or incomplete fetch must not be treated as an empty Canvas account or erase prior assignments. Historical imports are retained if a later response omits them.

The Homework Overview uses Canvas submission information for imported records. Points, due dates and course/assignment links come from Canvas. If BYU denies API access or a token expires, the UI reports it rather than pretending to have synced.
