# SessionTV changes

The live site at https://tannermayfield.dev/session-tv/ is built from `session-tv/public` in the `tech-portfolio` repository. GitHub Pages deploys pushes to `main` through `.github/workflows/deploy.yml`.

For requested SessionTV changes, run the relevant checks, commit only the requested files, push to `main`, and verify that the changed assets are served by the live site before reporting them as deployed. Use a Codex session with access to the portfolio repository root and authorized GitHub access for the publish step.

If your workspace is the `session-tv` subfolder and Git or network access is unavailable, report exactly which files changed and which publish step is blocked. Preserve those edits for a portfolio-root session. The optional `scripts/sync-session-tv.mjs` command copies from the separate standalone checkout into this folder. Run it only for changes made in the standalone checkout. It can overwrite changes made directly in this folder.

SessionTV Work chat automatically publishes successful changes from this checkout when the turn starts with a clean SessionTV folder. Report the result of the turn while SessionTV verifies the deployment.
