---
name: flashnote-publish
description: Publish a new FlashNote release — version bump → push tag → GitHub Actions builds. Supports stable and beta channels.
---

# FlashNote Push

Publish a new FlashNote release: bump version → push tag → GitHub Actions builds for all platforms.

## Git operations convention

All git operations in this skill go through `publish-git.py` — a purpose-built wrapper that only exposes the exact operations this skill needs. This keeps the permission scope narrow.

```
python3 .claude/scripts/publish-git.py <subcommand> [args...]
```

See `.claude/scripts/publish-git.py` for the full interface.

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

Ensure working directory is clean (no uncommitted changes):

```bash
python3 .claude/scripts/publish-git.py check-status
```

Output: `{"clean": bool, "files": [str]}`. If `clean: false`, stash before bumping:

```bash
python3 .claude/scripts/publish-git.py stash
```

And restore after pushing:

```bash
python3 .claude/scripts/publish-git.py stash-pop
```

## Step 2 — Determine version bump

Check the last tag and commits since then:

```bash
python3 .claude/scripts/publish-git.py last-tag
python3 .claude/scripts/publish-git.py commits-since <tag>
```

If `last-tag` returns `{"tag": null}`, this is the first release — start from `v0.1.0`.

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
python3 .claude/scripts/publish-git.py delete-tag v0.2.0-beta
python3 .claude/scripts/publish-git.py delete-remote-tag v0.2.0-beta
```

**Ask the user to confirm** the version string before proceeding.

## Step 3 — Bump version

Run the chosen `pnpm version` command. This automatically:
1. Updates `version` in `package.json`
2. Creates a git commit
3. Creates a git tag (e.g. `v0.2.0` or `v0.2.0-beta`)

For re-releases (version already set in package.json), just recreate the tag:

```bash
python3 .claude/scripts/publish-git.py create-tag v0.2.0-beta "0.2.0-beta"
```

## Step 4 — Push to trigger CI

```bash
python3 .claude/scripts/publish-git.py push origin HEAD:main
```

GitHub Actions picks up tags matching `v*` and starts building macOS/Windows/Linux packages.
Beta tags (`v*-beta*`) are marked as **pre-release** on GitHub Release.

## Step 5 — Monitor Release build

After pushing the tag, two workflows are triggered (CI + Release). We watch the **Release** workflow — that's the one that publishes artifacts.

### 5a. Find the Release workflow run

Use `--workflow release` to target `release.yml` specifically, not the CI workflow:

```bash
python3 .claude/scripts/ci-find-run.py --workflow release
```

If it returns a run ID, note it. Otherwise, grab it from:
`https://github.com/Sunshine334419520/flashnote/actions`

### 5b. Start background monitor

Use the `Monitor` tool:

```bash
python3 .claude/scripts/ci-watch.py <RUN_ID>
```

Monitor settings:
- `description`: "Release build for v<VERSION>"
- `timeout_ms`: 600000 (10 min timeout)
- `persistent`: false (stops when all jobs complete)

### 5c. When build completes

Check the releases API for the published artifacts:

```bash
python3 .claude/scripts/ci-check-release.py v<VERSION>
```

Report to the user:
- ✅ Success → send `PushNotification` with download links + release URL
- ❌ Failure → send `PushNotification` with error + Actions link
- Release URL: `https://github.com/Sunshine334419520/flashnote/releases/tag/v<VERSION>`

## Notes

- Never skip pre-flight checks
- If `pnpm version` fails, fix the issue before retrying
- Version follows SemVer: MAJOR.MINOR.PATCH
- Beta versions use a simple `-beta` suffix: `v0.2.0-beta`
- Promote beta → stable: run `/flashnote-publish` with `stable` channel, using the same version number without `-beta`
- The status bar in the app auto-displays the version from `package.json`
- `pnpm package` must use `--publish=never` (in `package.json` script) — publishing is handled by the `publish-release` workflow job via `softprops/action-gh-release`
- CI monitoring scripts live in `.claude/scripts/`: `ci-watch.py`, `ci-find-run.py`, `ci-check-release.py`
- **Permission setup**: See `.claude/settings.json`. The `publish-git.py` script is purpose-built and only exposes operations this skill needs.
