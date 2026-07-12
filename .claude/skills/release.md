# Release Skill

Publish a new FlashNote release: bump version → push tag → GitHub Actions builds for all platforms.

## Step 1 — Pre-flight checks

```bash
pnpm typecheck   # must pass
pnpm test        # must pass (if tests exist)
```

Ensure working directory is clean (no uncommitted changes).

## Step 2 — Determine version bump

Check commits since the last tag:

```bash
git describe --tags --abbrev=0 2>/dev/null || echo "no previous tag"
git log $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD)..HEAD --oneline
```

Decide the bump type:

| Bump | When |
|------|------|
| `patch` (0.1.0 → 0.1.1) | Only bug fixes |
| `minor` (0.1.0 → 0.2.0) | New features, new components |
| `major` (0.1.0 → 1.0.0) | Breaking changes or first stable |

**Ask the user to confirm** before proceeding. Show what the new version will be.

## Step 3 — Bump version

```bash
pnpm version <patch|minor|major>
```

This does three things automatically:
1. Updates `version` in `package.json`
2. Creates a git commit with the version number
3. Creates a git tag (e.g. `v0.2.0`)

## Step 4 — Push to trigger CI

```bash
git push --follow-tags
```

Pushes the version commit AND the tag. GitHub Actions picks up the `v*` tag and starts building macOS/Windows/Linux packages.

## Step 5 — Verify

Tell the user to check:
- GitHub Actions: `https://github.com/Sunshine334419520/flashnote/actions`
- GitHub Release: `https://github.com/Sunshine334419520/flashnote/releases` (artifacts appear when CI completes)

## Notes

- Never skip pre-flight checks
- If `pnpm version` fails, fix the issue before retrying
- Version number follows SemVer: MAJOR.MINOR.PATCH
- The status bar in the app auto-displays the version from `package.json`
