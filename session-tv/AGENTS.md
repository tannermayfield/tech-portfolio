# SessionTV changes

The live site at https://tannermayfield.dev/session-tv/ is built from `session-tv/public` in the `tech-portfolio` repository. GitHub Pages deploys pushes to `main` through `.github/workflows/deploy.yml`.

In SessionTV Work chat, make the requested changes in the linked checkout, run relevant checks, and report what changed. The companion owns Git operations and deploys successful changes after your turn when the SessionTV folder started clean. Leave commit, push, and live verification to the companion. Its GitHub Pages status in the chat reports the deployment result.

In a desktop or CLI Codex session with authorized access to the portfolio repository, run the relevant checks, commit only requested files, push to `main`, and verify the live site before reporting deployment. The optional `scripts/sync-session-tv.mjs` copies from the separate standalone checkout and can overwrite changes in this folder. Use it only for work done in the standalone checkout.
