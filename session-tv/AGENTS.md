# SessionTV changes

The live site at https://tannermayfield.dev/session-tv/ is built from `session-tv/public` in the `tech-portfolio` repository. GitHub Pages deploys pushes to `main` through `.github/workflows/deploy.yml`.

In SessionTV Work chat, make the requested changes in the linked checkout, run relevant checks, and report what changed. Call the publish_sessiontv tool after checks and before your final reply. Work chat gives this tool access to the configured GitHub Pages repository when the turn starts with a clean SessionTV folder. Report the result it returns. If it is unavailable, report that and leave the edits intact.

In a desktop or CLI Codex session with authorized access to the portfolio repository, run the relevant checks, commit only requested files, push to `main`, and verify the live site before reporting deployment. The optional `scripts/sync-session-tv.mjs` copies from the separate standalone checkout and can overwrite changes in this folder. Use it only for work done in the standalone checkout.

## Code structure and extending SessionTV

Rule: define each function once, and extend it through `SessionTV.hooks`. Never reassign a shared function (`const base=renderX; renderX=function(){...}`). `tests/structure.test.mjs` fails if a script does.

- The script order lives only in `public/js/manifest.js`. `boot.js` loads that list, and `tests/manifest.mjs` gives the tests the same list. Add a new script there, not in `boot.js` or a test.
- Screen code lives in `public/js/core/`, one module per area:
  - `util.js`: helpers, `toast`, `guard`
  - `model.js`: record types and shared state
  - `tv-controls.js`: channels, tuning, knobs, cutscenes, timer and on-screen display
  - `scenes.js`: cutscene themes
  - `tasks.js`: assignment details, submitting and skill levels
  - `work.js`: the work screen and the AI coach chat
  - `editor.js`: the code workspace
  - `projects.js`: project chat modes and the task board
  - `wrapup.js`: teach-back
  - `log.js`: the learning log
  - `guide.js`: the Menu
  - `settings.js`: Settings and My Database
  - `boot-state.js`: routing and loading records

  Feature files in `public/js/` keep their state inside an IIFE and use these globals.
- To extend core, register a handler for a named extension point in a feature file:
  - `SessionTV.hooks.after(name, fn)` runs after the core function.
  - `SessionTV.hooks.before(name, fn)` runs before it.
  - `SessionTV.hooks.wrap(name, (next, ...args) => ...)` runs around it. It can replace the core behavior by not calling `next`.

  Handlers compose in manifest order, and a handler from a later file sits outside one from an earlier file.
- The extension points are `settings:render`, `settings:open`, `dbView:render`, `guide:open`, `guide:render`, `work:render`, `coach:render`, `coach:send`, `subs:list`, `theme:pick`, `song:render` and `project:panel`. `core/hooks.js` lists the arguments for each.
- To add an extension point:
  1. Add its name and a one-line description to `points` in `core/hooks.js`.
  2. Make the core function that owns it run its body through the hook: `function renderX(){return SessionTV.hooks.run('x:render',arguments,()=>{ ...body... })}`.

  An unknown name throws, so a typo fails when the script loads.
- `core/preferences.js` lists every `sb.*` preference key with its default and a description. `recall(key)` with no fallback returns that default. Add any new key there.
- If the UI changes before a save finishes, pass an undo function: `guard(save, message, undo)`. When the save fails, `guard` runs undo (restore the old values and re-render) and then shows the error toast.
