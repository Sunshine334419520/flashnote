---
name: flashnote-publish
description: Publish a new FlashNote release — version bump → push tag → GitHub Actions builds. Supports stable and beta channels.
---

# FlashNote Push

Publish a new FlashNote release: bump version → push tag → GitHub Actions builds for all platforms.

## Step 0 — Choose channel

Ask the user which channel to publish:

| Channel | Tag format | GitHub Release | When |
|---------|-----------|:---:|------|
| `stable` (default) | `v0.2.0` | normal | Regular releases |
| `beta` | `v0.2.0-beta` | pre-release | Preview / testing |

If the user doesn't specify, default to `stable`.

## Step 1 — Pre-flight checks

```bash
pnpm typecheck   # must pass
pnpm test        # must pass
```

Ensure working directory is clean (no uncommitted changes).

## Step 2 — Determine version bump

Check commits since the last tag:

```bash
git describe --tags --abbrev=0 2>/dev/null || echo "no previous tag"
git log $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD)..HEAD --oneline
```

### Stable channel

| Bump | Command | Example |
|------|---------|---------|
| `patch` | `pnpm version patch` | 0.1.0 → 0.1.1 |
| `minor` | `pnpm version minor` | 0.1.0 → 0.2.0 |
| `major` | `pnpm version major` | 0.1.0 → 1.0.0 |

### Beta channel

Beta uses a simple `-beta` suffix, no auto-incrementing counter. Use `pnpm version` with an explicit version string:

| Scenario | Command | Example |
|----------|---------|---------|
| New beta based on next minor | `pnpm version 0.2.0-beta` | 0.1.0 → 0.2.0-beta |
| Promote beta to stable | `pnpm version 0.2.0` | 0.2.0-beta → 0.2.0 |

If the same beta tag already exists and needs a re-release, delete the old tag first:

```bash
git tag -d v0.2.0-beta && git push origin :refs/tags/v0.2.0-beta
```

**Ask the user to confirm** the version string before proceeding.

## Step 3 — Bump version

Run the chosen `pnpm version` command. This automatically:
1. Updates `version` in `package.json`
2. Creates a git commit
3. Creates a git tag (e.g. `v0.2.0` or `v0.2.0-beta.1`)

## Step 4 — Push to trigger CI

```bash
git push --follow-tags
```

GitHub Actions picks up tags matching `v*` and starts building macOS/Windows/Linux packages.
Beta tags (`v*-beta*`) are marked as **pre-release** on GitHub Release.

## Step 5 — Monitor CI build (background)

After pushing the tag, use the dedicated Python CI monitor script:

### 5a. Find the workflow run

```bash
python3 .claude/scripts/ci-find-run.py
```

If it returns the latest run, note the `RUN_ID`. Otherwise, grab it from:
`https://github.com/Sunshine334419520/flashnote/actions`

### 5b. Start background monitor

Use the `Monitor` tool with the CI watch script:

```bash
python3 .claude/scripts/ci-watch.py <RUN_ID>
```

Monitor settings:
- `description`: "CI build for v<VERSION>"
- `timeout_ms`: 600000 (10 min timeout)
- `persistent`: false (stops when all jobs complete)

### 5c. When build completes

Check the releases API for the published artifacts:

```bash
python3 .claude/scripts/ci-check-release.py v<VERSION>
```

Report to the user:
- ✅ Success: all 3 jobs passed → send `PushNotification` with download links
- ❌ Failure: which job failed → send `PushNotification` with error + Actions link
- Also provide the direct `https://github.com/Sunshine334419520/flashnote/releases/tag/v<VERSION>` link

## Notes

- Never skip pre-flight checks
- If `pnpm version` fails, fix the issue before retrying
- Version follows SemVer: MAJOR.MINOR.PATCH
- Beta versions use a simple `-beta` suffix: `v0.2.0-beta`
- Promote beta → stable: run `/flashnote-push` with `stable` channel, using the same version number without `-beta`
- The status bar in the app auto-displays the version from `package.json`
- `pnpm package` must use `--publish=never` (in `package.json` script) — publishing is handled by the `publish-release` workflow job via `softprops/action-gh-release`
- CI monitoring scripts live in `.claude/scripts/`: `ci-watch.py`, `ci-find-run.py`, `ci-check-release.py`
- **Permission setup**: `.claude/settings.json` has allow rules for `pnpm typecheck`, `pnpm test`, `npx tsc --noEmit`, `curl` to `api.github.com`, and `python3 .claude/scripts/*`. Run the `fewer-permission-prompts` skill if additional patterns need adding.
