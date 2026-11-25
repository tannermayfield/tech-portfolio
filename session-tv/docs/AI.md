# AI Connections and local Codex companion

## Status and scope

Supabase sign-in is the application account. It does not sign into ChatGPT or authorize model usage. General ChatGPT chat is optional and requires its own plan-use consent. There is no paid API fallback, subscription token extraction, or access to existing ChatGPT conversations. Demo visitors cannot pair or use an agent.

The companion implements the official Codex app-server stdio protocol, account checks, selected workspaces, coding requests and streaming progress. Its browser client exposes `SessionCompanion.pair(code)`, `status()`, `start({workspace,prompt,onEvent})`, `cancel()` and `disconnect()`. The installed background companion uses a separate persistent pairing secret so reloading does not require manual setup.

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

## ChatGPT with your existing subscription

The companion supports OpenAI’s official locally hosted app sign-in flow. ChatGPT authorization and inference execute in your local companion, separate from Codex and Supabase sign-in. There is no developer API key, paid API fallback or access to conversations or memory from ChatGPT.com.

1. Sign in to your private SessionTV workspace.
2. Open Settings → Preferences → AI Connections.
3. Under ChatGPT, click **Continue with ChatGPT** and approve SessionTV in the OpenAI browser window.
4. In [ChatGPT Settings → Usage](https://chatgpt.com/settings/usage), leave the option to use credits after your plan limit **off** for SessionTV. Requests consume your existing shared plan allowance; this does not add a separate allowance.
5. Return to SessionTV, check the connection, then open ChatGPT chat. Select a model available to your signed-in account.

OAuth uses a persistent host ID, a loopback callback with PKCE, state and nonce validation, verified ID-token signatures, and atomic local token storage outside project folders. Credentials are never sent to the static website or Supabase. Disconnect stops active requests, attempts remote revocation and clears local tokens while retaining the registration for future sign-in. Any unconfirmed remote revocation is reported.

Chat history belongs to SessionTV and is saved with your private workspace. Model requests send the required history to OpenAI with `store:false` and `stream:true`; a request is successful only after `response.completed`. Usage-limit failures are displayed without switching to a paid provider. Existing speech controls work with this chat, too.

References: [local-app overview](https://developers.openai.com/siwc/token-sharing-open-source), [registration](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

## Codex model and effort defaults

The companion reads the available Codex catalog via `model/list`, follows pagination and uses its recommended default model (or the first model in server order if no default is advertised). This follows Codex’s recommendation rather than guessing model versions from names. It refreshes on each run.

Plan and Apply use `gpt-6-luna` at `low` (Light). If Luna is unavailable, they report an error instead of silently falling back to Sol. Work sends `medium` by default and allows `low`, `medium`, `high`, or `xhigh` when the selected model advertises support. The browser resets Work to Medium when entering the chat; ordinary streaming re-renders preserve the choice. Unsupported combinations fail clearly rather than silently changing effort. Model and effort are explicitly set on `turn/start`, including resumed threads.

## Project chats and folder links

Open Settings → My Database → Projects, then choose Create linked project or a project’s Folder & chats button. Active project panels also provide a chat shortcut. Sign in and pair the companion first. Refresh computer folders and select an authorized folder before creating a new project. Existing projects can select a folder and save its link. New project creation requires a folder, including when adding project tasks through the general Add Item form. Create a named chat and send a message. Each chat saves its own Codex thread reference and transcript in private account preferences. Further messages resume that thread in its original folder. A changed folder link requires a new chat or restoring the previous link. Chats require the same computer and dedicated Codex profile where the thread was created. Restart the companion after updating its source. One request can run at a time. Polybot folders currently remain separate folder choices.

## Simple startup and dedicated forms

Double-click Start Session TV.cmd in the standalone app directory. First run asks for the Supabase User UID and authorized project folders, saving them to %LOCALAPPDATA%/SessionTV-Companion/settings.json. Later launches reuse those settings. Run Start Session TV.cmd -Configure to replace the folder list or UID. Keep the companion window open and pair from the private website. This launcher starts manually and does not install a background or login service.

Settings → My Database has distinct Classes, Assignments, Skills and Projects entry points. Each opens its own form. Create the class before adding assignments. Project creation includes a required authorized computer folder. The Projects section has no Add project task action.

## Native project creation and Codex modes

In My Database → Projects, Create project opens a name field and Choose a folder. The paired local companion opens a Windows folder picker and persists the selected folder immediately. Create prepares and names three persistent Codex conversations before saving the project. Retried provisioning reuses the project-and-folder-specific references. Existing projects can use Manage → Prepare starter chats to retain their earlier histories and complete setup. Project chats are shown only in the project's work screen using Plan, Apply and Work. Plan/Apply have read-only filesystem profiles and Work has bounded project writes. Each mode has separate conversation history and coaching instructions.

The Windows companion explicitly uses MXC. This machine passed the native MXC startup probe and a real prepared/resumed Apply conversation returned the expected connection-test reply. Devices without supported MXC need a compatible, properly provisioned supported sandbox before chats can start. The companion does not switch to full-access execution.

Project menu channels are based on project records, so projects without tasks are visible. Project rows show completed sprint counts and time. Exact per-project time is recorded for current/new sessions. Historical sessions without per-project allocations cannot be reconstructed precisely.
