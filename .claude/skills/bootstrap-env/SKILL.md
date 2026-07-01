---
name: bootstrap-env
description: One-click initialize the FlashNote base toolchain (node, pnpm, git, python3, C++ build tools) on Windows/macOS/Linux for a fresh clone. Detects OS, installs missing prerequisites admin-free where possible, ensures tools resolve from Claude Code's non-interactive Bash tool, and verifies. Does not run pnpm install/dev/test/build. Triggers on: first clone, setup environment, bootstrap toolchain, initialize base env, install prerequisites, node pnpm git python build tools missing, fresh clone setup, prepare dev environment, 环境初始化, 配置环境, 准备开发环境, 初始化依赖环境.
---

# Bootstrap Env — First-Clone Toolchain Setup

Run this on a fresh clone, before the first `pnpm install`. It ensures the **base toolchain** the project needs is installed and resolvable from Claude Code's non-interactive Bash tool. It does **not** run `pnpm install`, `electron-rebuild`, `dev`, `test`, or `build` — those are dependency-materialization / build / integration-test steps, documented in Next Steps.

Why this skill exists: the non-interactive Bash tool does **not** source `~/.bashrc` or `~/.profile`. PATH fixes placed there are dead for the tool. The durable fix is either system-wide install (the tool inherits the OS process env) or the committed SessionStart hook in `.claude/hooks/bootstrap-env-path.sh` (writes `$CLAUDE_ENV_FILE`). See PATH Mechanism.

## Required Base Env

| Tool | Floor | Why |
|------|-------|-----|
| Node | ≥ 20 LTS | Electron 42 → Node 22 baseline; tsconfig ES2022 → ≥18; 20 leaves headroom |
| pnpm | ≥ 10 | `pnpm-workspace.yaml` uses `allowBuilds` + `minimumReleaseAgeExclude` (pnpm 10 syntax); lockfile v9.0 is pnpm 9+ |
| git | any recent | clone / operations |
| Python 3.x (real) | 3.x | node-gyp at `electron-rebuild` time. On Windows, `python3` is often a Store alias and `python` is 2.7 — both are **not** real Python 3 |
| C++ build tools | — | only exercised at `electron-rebuild` time: Win=VS 2022 Build Tools, mac=Xcode CLT, Linux=build-essential |

Note: `better-sqlite3` ships prebuilds for Node LTS, so `pnpm install` does **not** compile C++. The C++ toolchain is only needed when `electron-rebuild` rebuilds against Electron's ABI — see Next Steps.

## Quick Decision Matrix

| Tool \ OS | Windows (Git Bash) | macOS | Linux (deb) | Admin? |
|-----------|---|---|---|---|
| Node ≥20 | `winget install Schniz.fnm` → `fnm install 22` (user dir); or nodejs.org `.msi` | `brew install fnm` → `fnm install 22`; or `nvm` | `fnm install 22`; or NodeSource setup | fnm/nvm: no; .msi/NodeSource/apt: yes |
| pnpm ≥10 | `npm i -g pnpm@10` (→ `%APPDATA%\npm`) | `npm i -g pnpm@10`; or `brew install pnpm` | `npm i -g pnpm@10` | `npm i -g`: no |
| git | ships with Git Bash; else `winget install Git.Git` | `xcode-select --install` (includes git) | `sudo apt install git` | Win/mac: no; Linux: yes |
| Python 3 real | `winget install Python.Python.3.12 --scope user` → `npm config set python "<path>"` | `brew install python@3`; or ships with CLT | `sudo apt install python3 python3-dev` | Win winget user / mac brew: no; Linux: yes |
| C++ build tools | VS 2022 Build Tools + "Desktop development with C++" workload (admin hand-off) | `xcode-select --install` | `sudo apt install build-essential` | Win: yes (hand-off); mac: prompt; Linux: yes (hand-off) |

Admin hand-off pattern: print the exact elevated command and ask the user to run it via the session `!` prefix (triggers UAC) or a separate privileged terminal, then re-run Verify. The skill itself does not attempt `sudo`/UAC — the non-interactive Bash tool has no tty for a password.

## Detect Workflow

1. OS:
```
case "$(uname -s)" in MINGW*|MSYS*) echo windows;; Darwin) echo macos;; Linux) echo linux;; *) echo unknown;; esac
```
2. Tools present + versions:
```
command -v node >/dev/null && node -v || echo "node MISSING"
command -v pnpm >/dev/null && pnpm -v || echo "pnpm MISSING"
command -v git  >/dev/null && git --version || echo "git MISSING"
```
3. Floor check:
```
node -v | awk -F. '{exit !($1>=20)}' 2>/dev/null || echo "node < 20"
pnpm -v | awk -F. '{exit !($1>=10)}' 2>/dev/null || echo "pnpm < 10"
```
4. Real Python 3 (Windows trap — `python3` may be a Store alias under `WindowsApps`):
```
for c in py python3 python; do
  p="$(command -v $c 2>/dev/null)" || continue
  [ -n "$p" ] || continue
  case "$p" in *WindowsApps*) echo "$c -> Store alias (NOT real): $p";; *) "$c" -c 'import sys; print(sys.executable, sys.version)' 2>/dev/null && break;; esac
done
```
5. Report a missing/insufficient table; do not install yet.

## Install Workflow

Prefer admin-free methods first. For each missing tool, run the cell from the Quick Decision Matrix for the detected OS.

### Windows / Git Bash
1. pnpm: `npm i -g pnpm@10` (admin-free, lands in `%APPDATA%\npm`).
2. Node: if missing, `winget install Schniz.fnm` then `fnm install 22` (admin-free, user dir). fnm's shell hook lives in dotfiles the Bash tool skips — the SessionStart hook (PATH Mechanism layer 2) exposes it.
3. Python 3 real: `winget install Python.Python.3.12 --scope user` (admin-free, `%LOCALAPPDATA%\Programs\Python`). Then `npm config set python "C:/Users/<you>/AppData/Local/Programs/Python/Python312/python.exe"`.
4. C++ build tools (admin hand-off): print
```
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```
and ask the user to run it elevated via `!`. Required only for `electron-rebuild` (Next Steps), not for `pnpm install`.

### macOS
1. pnpm: `npm i -g pnpm@10`.
2. Node: `brew install fnm` → `fnm install 22`; or `brew install node@20`.
3. git + C++ tools: `xcode-select --install` (one prompt covers both).
4. Python 3: `brew install python@3` (or comes with CLT).

### Linux (deb)
1. pnpm: `npm i -g pnpm@10`.
2. Node: `fnm install 22` (admin-free); or NodeSource (sudo).
3. git + C++ + Python (sudo hand-off): print
```
sudo apt update && sudo apt install -y git build-essential python3 python3-dev
```
and ask the user to run it via `!`.

## PATH Mechanism

The Bash tool inherits the Claude process env (on Windows = registry User+Machine PATH), not dotfiles. Apply the lightest layer that makes Verify pass:

1. **System-wide install** (winget user-scope → registry User PATH; `brew`; `apt`): the tool inherits it after **restarting Claude**. Preferred — no extra files.
2. **Committed SessionStart hook** (`.claude/hooks/bootstrap-env-path.sh`, registered in `.claude/settings.json`): writes `$CLAUDE_ENV_FILE` each session; exposes fnm/nvm-managed node and prepends common user-global dirs. Dynamic, team-wide, idempotent — the durable replacement for `.bashrc`/`.profile`. Use this for admin-free fnm/nvm installs.
3. **Fallback** (per-user, gitignored): if Verify still fails, write `env.PATH` = **full composed snapshot** (discovered tool dirs + inherited `$PATH`) to `.claude/settings.local.json`. Note: `env.PATH` **replaces, does not append**; there is no `${PATH}` interpolation — compose the full string or you will break `git`/`ls`/etc. Takes effect next session.
4. **Immediate verify** (same session): prefix verify commands inline, e.g. `PATH="/c/Users/<you>/AppData/Roaming/npm:$PATH" pnpm -v`, since settings env may not hot-reload mid-session.

Do not edit `~/.bashrc` or `~/.profile`. They are not sourced by the Bash tool; their PATH lines are dead for it. At most, report them as redundant (see Gotchas).

## Verify Workflow

1. Re-resolve each tool from the Bash tool (not a login shell):
```
command -v node && node -v
command -v pnpm && pnpm -v
command -v git  && git --version
```
2. Confirm floors: node ≥ 20, pnpm ≥ 10.
3. Confirm Python 3 is real (rerun Detect step 4 — path must not contain `WindowsApps`; version must be 3.x).
4. If any fail and a hook/env write was just done, remember settings env applies next session — use the inline-prefix (PATH Mechanism layer 4) to verify now, and tell the user to restart Claude for the durable fix.
5. Stop. Do not run `pnpm install` / `dev` / `test` / `build`.

## Next Steps

The skill stops at "toolchain ready". The user then runs, in order:
1. `pnpm install` — downloads Electron binary (~100 MB) + better-sqlite3 prebuild (no C++ compile).
2. `npx @electron/rebuild -f -w better-sqlite3` — **required before `pnpm dev`**: rebuilds better-sqlite3 against Electron's ABI. This is where the C++ toolchain is exercised.
3. `pnpm dev`.

Latent project gap (skill documents, does not fix): `@electron/rebuild` is in devDeps but there is **no `rebuild` npm script and no `postinstall`**, and `electron.vite.config.ts` does not wire it. So after `pnpm install`, better-sqlite3 is built for system-node ABI and `pnpm dev` will fail with an ABI-mismatch error until step 2 is run manually. Recommend the maintainer add `"rebuild": "electron-rebuild -f -w better-sqlite3"` to `package.json` scripts and a `"packageManager": "pnpm@10.x.x"` field (so `corepack` auto-selects pnpm). The skill does not edit `package.json`.

## Gotchas
1. Windows `python3` is often the Store `AppInstallerPythonRedirector.exe` (path contains `WindowsApps`) and `python` is 2.7 — neither is real. Install via `winget install Python.Python.3.12 --scope user` and `npm config set python "<real path>"`.
2. `corepack prepare --activate` is deprecated (and corepack is removed in Node 25+). Use `npm i -g pnpm@10` — admin-free and reliable.
3. `env.PATH` in `settings.local.json` **replaces** the inherited PATH; no `${PATH}` interpolation. Always compose the full PATH (tool dirs + current `$PATH`), or `git`/`ls`/coreutils break.
4. Settings `env` changes may not hot-reload mid-session. For immediate verification, prefix PATH inline; for the durable fix, restart Claude.
5. `~/.bashrc` and `~/.profile` are not sourced by the non-interactive Bash tool. Their PATH lines are dead for it — report as redundant, do not auto-edit (they are user-global files; this machine's `/e/node` works via the registry User PATH, not `.bashrc`).
6. Restricted-network (e.g. China) downloads: Electron binary + better-sqlite3 prebuild are the failure points. Optional mirrors: `pnpm config set registry https://registry.npmmirror.com` and `export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`. Global `settings.json` already sets `HTTP_PROXY=127.0.0.1:7890`.
7. Cross-platform hygiene (repo-local, admin-free): `git config core.autocrlf input` (LF in repo) and `git config core.longpaths true` (node_modules deep paths exceed 260 on Windows).
8. Windows Defender real-time scan can lock `node_modules` during `pnpm install` → spurious `EPERM`/`EBUSY`. Add the project folder to exclusions or pause scanning during install.
