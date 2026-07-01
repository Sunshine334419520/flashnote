#!/usr/bin/env bash
# bootstrap-env-path.sh — FlashNote SessionStart hook.
#
# Ensures the project toolchain (node/pnpm/...) is resolvable from Claude Code's
# NON-INTERACTIVE Bash tool. That tool does NOT source ~/.bashrc or ~/.profile,
# so PATH fixes placed in those dotfiles are dead for it. This hook writes to
# $CLAUDE_ENV_FILE, which propagates to every subsequent Bash tool subprocess in
# the session.
#
# Idempotent and machine-agnostic: only exposes fnm/nvm-managed node and
# prepends common user-global tool dirs that already exist on disk. Machine-
# specific paths (e.g. a node install at /e/node, a specific Python3 path) do
# NOT belong here — the skill writes those to .claude/settings.local.json
# env.PATH as a per-user fallback.
#
# This is the durable, team-wide replacement for the scattered ~/.bashrc and
# ~/.profile PATH lines.

# Only meaningful inside a Claude Code session (CLAUDE_ENV_FILE is set by the
# harness for SessionStart hooks).
[ -n "$CLAUDE_ENV_FILE" ] || exit 0

# 1. Expose fnm/nvm-managed node. Their shell hooks normally live in dotfiles
#    the Bash tool skips, so an fnm/nvm-installed node is invisible without this.
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --shell bash 2>/dev/null)" 2>/dev/null || true
fi
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  \. "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi

# 2. Prepend common user-global tool dirs if they exist and aren't already on PATH.
prepend_missing() {
  local d
  for d in "$@"; do
    [ -d "$d" ] || continue
    case ":$PATH:" in
      *":$d:"*) ;;
      *) PATH="$d:$PATH" ;;
    esac
  done
}
prepend_missing \
  "$HOME/.local/bin" \
  "$HOME/AppData/Roaming/npm" \
  "/c/Program Files/nodejs"

# 3. Propagate the composed PATH to all Bash tool subprocesses this session.
#    (printf avoids interpretation of backslashes in paths.)
printf 'export PATH=%s\n' "$PATH" >> "$CLAUDE_ENV_FILE"
