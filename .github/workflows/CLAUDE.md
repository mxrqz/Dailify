# .github/workflows — GitHub Actions

Repo-wide rules: [`/RULES.md`](../../RULES.md). Workflow commits are unscoped `ci: ...` (RULES.md,
"Git and task tracking").

## What runs here

- Nothing here deploys. Cloudflare Workers Builds deploys the web and the server on every push to
  `main`, so editing a workflow never changes what ships to the web.
- `android-release.yml`: a `v*` tag builds the signed arm64 APK and AAB and
  attaches them to a GitHub release; a manual dispatch uploads them as the `mewki-android` artifact.
  Versioning, signing secrets and the NDK pin are in `apps/web/src-tauri/CLAUDE.md` ("Release",
  "Run"); read it before renaming the file (it resets `versionCode`) or bumping `NDK_VERSION`.
- `check.yml` runs `bun install --frozen-lockfile` and `bun run check` (bun 1.3.9, Node 24) on
  pushes to `main` and on PRs. It only reports: Workers Builds can't wait on a GitHub check, so a red
  run on `main` still deploys. The parallel run still flakes on duplicates-sheet and the
  functions.test TZ cases (bd `Dailify-nhp`); fix that before making it a required status.
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

- An artifact or release step fails when it matches no files: `fail_on_unmatched_files: true` on
  `softprops/action-gh-release`, `if-no-files-found: error` on `upload-artifact`, because `Collect`
  (`find -exec cp`) stays green when the build produced nothing. A required `VITE_*` is asserted
  with `: "${VAR:?...}"` at the top of the build step.
- Use the Node 24 majors (`actions/checkout@v6`, `actions/setup-java@v5`,
  `actions/upload-artifact@v6`, `softprops/action-gh-release@v3`): hosted runners dropped `node20`
  in September 2026.

The root `bun run format` also formats `.github`.
