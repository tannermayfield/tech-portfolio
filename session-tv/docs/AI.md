# AI Connections and local Codex companion

## Status and scope

Supabase sign-in is the application account. It does not sign into ChatGPT or authorize model usage. General homework AI remains unavailable until an eligible, authorized provider is configured. There is no paid API fallback, subscription token extraction, or access to existing ChatGPT conversations. Demo visitors cannot pair or use an agent.

The companion implements the official Codex app-server stdio protocol, account checks, selected workspaces, coding requests and streaming progress. Its browser client exposes `SessionCompanion.pair(code)`, `status()`, `start({workspace,prompt,onEvent})`, `cancel()` and `disconnect()`. Tokens for pairing live only in page memory; reloading requires restarting and pairing the companion again.

## Install and start on your own computer

Use a current official Codex CLI that supports named permission profiles and app-server. The installed CLI inspected during implementation was `0.164.0-alpha.11.1`; beta protocol changes can require an update. This build accepts `on-request` approvals and rejects the older `untrusted` setting, so the companion uses `on-request` and declines approval requests. Windows sandbox setup may require the official Codex first-run setup. The companion never bypasses a sandbox error.

Create a dedicated Codex profile outside every selected project. Keep credentials and the companion's environment outside the public website. Example PowerShell setup (replace paths and public configuration):

```powershell
New-Item -ItemType Directory -Path "$env:LOCALAPPDATA\SessionTV-Codex" -Force
$env:CODEX_HOME = "$env:LOCALAPPDATA\SessionTV-Codex"
codex login

$env:SESSIONTV_CODEX_HOME = $env:CODEX_HOME
$env:SESSIONTV_WORKSPACES = '["C:\\Users\\tanne\\Projects\\my-coding-project"]'
$env:SESSIONTV_OWNER_ID = 'YOUR-SUPABASE-AUTH-USER-UUID'
$env:SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co'
$env:SUPABASE_PUBLISHABLE_KEY = 'YOUR-PUBLIC-PUBLISHABLE-KEY'
node companion/server.mjs
```

Run this from the Session TV source folder. `SESSIONTV_CODEX_BINARY` optionally selects an absolute `codex.exe` path; no shell is used to launch it. Do not use an API key login. `SESSIONTV_ORIGIN` defaults to `https://tannermayfield.dev`; an exact local-development origin can be explicitly selected. `SESSIONTV_COMPANION_PORT` defaults to 4319; match `SessionTVConfig.companionUrl` if changed.

Sign into the private Session TV workspace, open AI Connections, and enter the one-use pairing code printed in your terminal. The code expires in ten minutes and is limited to ten attempts. A paired page receives a separate secret valid for 30 minutes; Supabase must also validate the owner on every request. Stop the service with Ctrl+C. Never forward its port or publish it through a tunnel.

## Security and approvals

The listener binds only `127.0.0.1`. It checks the exact Host and browser Origin, verifies the Supabase bearer with `/auth/v1/user`, requires the configured owner UUID, and authenticates a separate pairing token. CORS is only one layer. No status or agent endpoint is anonymously available. The browser cannot supply arbitrary RPC methods or executable names.

Only startup-selected canonical project directories can be used. Each run gets its own app-server process and runtime workspace. A custom permission profile permits minimal system runtime reads and reads/writes in that workspace, protects repository control/configuration paths, and blocks command network access. The companion verifies the selected profile and approval policy before starting inference. Authentication uses a dedicated local profile and only ChatGPT-managed Codex accounts are accepted. API credential environment variables are removed from child processes.

Additional permission, command-approval and file-approval requests are declined. This is deliberately conservative: ordinary sandbox-permitted edits and operations may work, but an operation needing approval must be reviewed and performed separately in your terminal. There is no browser action that grants unrestricted access. OS/runtime sandbox restrictions may prevent some tools or dependencies from running; the app reports that limitation. Review modified-file and command-result events in the coding log. No automated test against your actual projects has been run.

The authenticated site and any scripts it loads are trusted by the pairing session. An XSS vulnerability on that origin would compromise its application session. Pair only your own deployment, keep browser dependencies current, and stop the companion when finished. Selected workspaces themselves should contain only material you authorize the agent to read. Run potentially untrusted projects in a separate OS account or VM.

## Browser permissions and offline behavior

Pairing is user-initiated. Modern browsers can ask permission for loopback/local-network access; allow it for your portfolio only if you intend to connect your computer. The client declares `targetAddressSpace: 'loopback'`. If blocked, open browser site settings and review Loopback network access. Browser/enterprise policy can still block hosted-to-loopback connections; do not disable browser security or expose the service publicly. Data features work without the companion. See [Chrome's Local Network Access guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access).

## ChatGPT plan-backed general chat and future identity linking

Official documentation distinguishes identity login from authorization to use a ChatGPT plan. Its open-source/local flow is available to eligible clients; remotely hosted apps require admission. The portfolio frontend plus local companion is a hybrid, so this implementation does not assume eligibility or claim an approved OpenAI client. Request confirmation/admission for this exact deployment before enabling general chat. The frontend has no nonfunctional OpenAI login button. Review the [quickstart](https://developers.openai.com/siwc/quickstart), [official integration cookbook](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt) and [Sign in with ChatGPT terms](https://openai.com/policies/sign-in-with-chatgpt-terms/).

When authorized, add an AI-provider adapter in the local companion that handles documented OAuth/PKCE, ID-token verification, explicit plan-use scope checks, OS-secure credential storage, token refresh, model discovery and streaming. Preserve the Supabase UUID: linking an OpenAI identity requires an authenticated account-link flow with proof of both identities and a uniqueness constraint. Do not trust browser-supplied identity claims or create duplicate accounts by email. Store application conversation history in the private Supabase conversation tables; OpenAI login does not import ChatGPT memory or conversation history.

Codex integration uses its own officially managed ChatGPT login, independent of future general-chat authorization. It sends no explicit API billing configuration. Subscription limits and credits can apply; manage them in your ChatGPT account. Claude remains a future provider adapter and is not connected through subscription-token sharing.

References: [Codex app-server](https://learn.chatgpt.com/docs/app-server), [permission profiles](https://learn.chatgpt.com/docs/permissions). These are evolving beta interfaces. Account access, provider authorization and real coding runs require owner setup and were not verified against a live owner account. A live protocol probe successfully initialized an empty dedicated profile, reported signed out, and listed the required permission profile. A metadata-only thread-start probe was refused by this execution environment's unelevated Windows sandbox because it cannot enforce split filesystem read restrictions. No coding turn or inference was started. Complete official Windows sandbox setup (or use a supported properly isolated runtime) before attempting coding; do not switch to unrestricted access to work around this error.

## Project chats and folder links

Open Settings → My Database → Projects, then choose Create linked project or a project’s Folder & chats button. Active project panels also provide a chat shortcut. Sign in and pair the companion first. Refresh computer folders and select an authorized folder before creating a new project. Existing projects can select a folder and save its link. New project creation requires a folder, including when adding project tasks through the general Add Item form. Create a named chat and send a message. Each chat saves its own Codex thread reference and transcript in private account preferences. Further messages resume that thread in its original folder. A changed folder link requires a new chat or restoring the previous link. Chats require the same computer and dedicated Codex profile where the thread was created. Restart the companion after updating its source. One request can run at a time. Polybot folders currently remain separate folder choices.
