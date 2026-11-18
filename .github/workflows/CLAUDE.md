# .github/workflows — GitHub Actions

Repo-wide rules: [`/RULES.md`](../../RULES.md). Workflow commits are unscoped `ci: ...` (RULES.md,
"Git and task tracking").

## What runs here

- Nothing here deploys. Cloudflare Workers Builds deploys the web and the server on every push to
  `main`, so editing a workflow never changes what ships to the web.
- `android-release.yml` is the only workflow. A `v*` tag builds the signed arm64 APK and AAB and
  attaches them to a GitHub release; a manual dispatch uploads them as the `mewki-android` artifact.
  Versioning, signing secrets and the NDK pin are in `apps/web/src-tauri/CLAUDE.md` ("Release",
  "Run"); read it before renaming the file (it resets `versionCode`) or bumping `NDK_VERSION`.
- No workflow runs `bun run check`, and nothing gates `main` (RULES.md, "Verify").
- The APK's web bundle gets `VITE_*` only from repo variables listed in the build step's `env:`. A
  new `VITE_*` needs a repo variable and a line there, or the app ships without it.

## Rules for workflow code

- Secrets and step outputs reach a shell script only through `env:`, never as `${{ }}` inside
  `run:`, where the shell evaluates `$`, backticks and quotes in a password or tag name:

  ```yaml
  - env:
      KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
    run: echo "keyAlias=$KEY_ALIAS" >> keystore.properties
  ```

  The `Android signing`, `Build APK + AAB` and `Collect` steps still interpolate inline (legacy):
  move them when you touch them.

- An artifact or release step fails when it matches no files: `fail_on_unmatched_files: true` on
  `softprops/action-gh-release`, `if-no-files-found: error` on `upload-artifact`. Neither is set
  today, and `Collect` (`find -exec cp`) stays green when the build produced nothing.
- Use the Node 24 majors: `actions/checkout@v6`, `actions/setup-java@v5`,
  `actions/upload-artifact@v6`, `softprops/action-gh-release@v3`. The three `actions/*@v4` and
  `action-gh-release@v2` used today declare `node20`, which hosted runners dropped in September 2026.
  `setup-bun@v2` and `rust-cache@v2` are already on node24.

## Adding a check workflow

- Run `bun install --frozen-lockfile` then `bun run check` on pushes and PRs to `main`.
- Pin bun 1.3.9 (`oven-sh/setup-bun@v2`), the same version as `android-release.yml`; no
  `packageManager` field pins it anywhere else.
- Add `actions/setup-node@v6` with Node >= 22.4: vitest runs under Node, and the web suite's
  `execArgv: ["--no-experimental-webstorage"]` (`apps/web/vite.config.ts`) is rejected by older
  Nodes.
- The parallel `bun run check` times out duplicates-sheet and the functions.test TZ cases today (bd
  `Dailify-nhp`). Fix that before making the check a required status.

`bun run format` formats only each package's `src` (plus the server's `test`), so run
`bunx prettier --write .github` after editing here.
