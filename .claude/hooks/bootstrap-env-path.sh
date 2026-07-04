#!/usr/bin/env bash
# bootstrap-env-path.sh — FlashNote SessionStart hook.
#
# Ensures the project toolchain (node/pnpm/...) is resolvable from Claude Code's
# NON-INTERACTIVE Bash tool. That tool does NOT source ~/.bashrc or ~/.profile,
# so PATH fixes placed in those dotfiles are dead for it. This hook writes to
# $CLAUDE_ENV_FILE, which propagates to every subsequent Bash tool subprocess in
# the session.
#
# IMPORTANT: We build PATH from a clean base because the inherited macOS PATH
# may contain unquoted spaces (e.g. /etc/paths.d entries from VMware Fusion)
# that break 'export PATH=...' when written to the env file.
#
# Idempotent and machine-agnostic: only exposes fnm/nvm-managed node and
# prepends common user-global tool dirs that already exist on disk.
#
# This is the durable, team-wide replacement for the scattered ~/.bashrc and
# ~/.profile PATH lines.

# Only meaningful inside a Claude Code session (CLAUDE_ENV_FILE is set by the
# harness for SessionStart hooks).
[ -n "$CLAUDE_ENV_FILE" ] || exit 0

# ── Build PATH from a clean base ──────────────────────────────────────────
# Start with known-safe directories, avoiding paths with spaces.
SAFE_PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Add common user tool directories if they exist on disk.
for d in \
  "$HOME/.local/bin" \
  "$HOME/Library/pnpm" \
  "$HOME/Library/Application Support/fnm" \
  "$HOME/AppData/Roaming/npm" \
  "/c/Program Files/nodejs"; do
  [ -d "$d" ] || continue
  case ":$SAFE_PATH:" in
    *":$d:"*) ;;
    *) SAFE_PATH="$d:$SAFE_PATH" ;;
  esac
done

# Expose fnm-managed node (common: ~/Library/Application Support/fnm).
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --shell bash 2>/dev/null)" 2>/dev/null || true
elif [ -f "$HOME/.local/share/fnm/fnm" ]; then
  :
elif [ -f "$HOME/Library/Application Support/fnm/fnm" ]; then
  PATH="$HOME/Library/Application Support/fnm:$PATH"
fi

# Expose nvm-managed node.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  \. "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi

# Merge fnm/nvm-discovered node into SAFE_PATH if available.
if command -v node >/dev/null 2>&1; then
  NODE_DIR="$(dirname "$(command -v node)")"
  case ":$SAFE_PATH:" in
    *":$NODE_DIR:"*) ;;
    *) SAFE_PATH="$NODE_DIR:$SAFE_PATH" ;;
  esac
fi

# Add pnpm global bin if pnpm is available.
if command -v pnpm >/dev/null 2>&1; then
  PNPM_HOME="$(pnpm bin -g 2>/dev/null)" || true
  if [ -n "$PNPM_HOME" ] && [ -d "$PNPM_HOME" ]; then
    case ":$SAFE_PATH:" in
      *":$PNPM_HOME:"*) ;;
      *) SAFE_PATH="$PNPM_HOME:$SAFE_PATH" ;;
    esac
  fi
fi

# ── Propagate to all Bash tool subprocesses this session ─────────────────
# Truncate first (> not >>) to clear any old broken content from prior runs.
printf 'export PATH='\''%s'\''\n' "$SAFE_PATH" > "$CLAUDE_ENV_FILE"
