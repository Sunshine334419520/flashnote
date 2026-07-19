#!/usr/bin/env python3
"""
publish-git.py — Git operations for flashnote-publish skill.

Purpose-built for the publish workflow. NOT a general git wrapper.
Each subcommand maps to one specific operation the skill needs.

Usage:
  publish-git.py check-status              → {"clean": bool, "files": [str]}
  publish-git.py last-tag                  → {"tag": str | null}
  publish-git.py commits-since <tag>       → {"count": int, "commits": [str]}
  publish-git.py delete-tag <tag>          → exit 0 if ok
  publish-git.py delete-remote-tag <tag>   → exit 0 if ok
  publish-git.py create-tag <tag> <msg>    → exit 0 if ok
  publish-git.py push <remote> <refspec>   → exit 0 if ok
  publish-git.py stash                     → exit 0 if ok
  publish-git.py stash-pop                 → exit 0 if ok

Output convention:
  - Data commands → JSON on stdout
  - Action commands → exit code 0/1, errors on stderr
"""

import json
import subprocess
import sys


def run(cmd: list[str], capture: bool = True) -> subprocess.CompletedProcess:
    """Run a git command. Returns CompletedProcess."""
    try:
        return subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        print("git not found", file=sys.stderr)
        sys.exit(1)


def cmd_check_status():
    """Check if working tree has uncommitted changes."""
    result = run(["git", "status", "--short"])
    lines = [l.strip() for l in result.stdout.strip().split("\n") if l.strip()]
    clean = len(lines) == 0
    print(json.dumps({"clean": clean, "files": lines}))


def cmd_last_tag():
    """Get the most recent tag name."""
    result = run(["git", "describe", "--tags", "--abbrev=0"])
    tag = result.stdout.strip() if result.returncode == 0 else None
    print(json.dumps({"tag": tag}))


def cmd_commits_since():
    """List commits since a given tag."""
    if len(sys.argv) < 3:
        print(json.dumps({"error": "usage: publish-git.py commits-since <tag>"}))
        sys.exit(1)
    tag = sys.argv[2]
    result = run(["git", "log", f"{tag}..HEAD", "--oneline"])
    commits = [l.strip() for l in result.stdout.strip().split("\n") if l.strip()]
    print(json.dumps({"count": len(commits), "commits": commits}))


def cmd_delete_tag():
    """Delete a local tag."""
    if len(sys.argv) < 3:
        print("usage: publish-git.py delete-tag <tag>", file=sys.stderr)
        sys.exit(1)
    tag = sys.argv[2]
    result = run(["git", "tag", "-d", tag])
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(1)


def cmd_delete_remote_tag():
    """Delete a tag from the remote."""
    if len(sys.argv) < 3:
        print("usage: publish-git.py delete-remote-tag <tag> [remote=origin]", file=sys.stderr)
        sys.exit(1)
    tag = sys.argv[2]
    remote = sys.argv[3] if len(sys.argv) > 3 else "origin"
    result = run(["git", "push", remote, f":refs/tags/{tag}"])
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(1)


def cmd_create_tag():
    """Create an annotated tag."""
    if len(sys.argv) < 4:
        print("usage: publish-git.py create-tag <tag> <message>", file=sys.stderr)
        sys.exit(1)
    tag = sys.argv[2]
    msg = sys.argv[3]
    result = run(["git", "tag", tag, "-m", msg])
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(1)


def cmd_push():
    """Push commits and tags to remote."""
    if len(sys.argv) < 4:
        print("usage: publish-git.py push <remote> <refspec>", file=sys.stderr)
        sys.exit(1)
    remote = sys.argv[2]
    refspec = sys.argv[3]
    result = run(["git", "push", remote, refspec, "--follow-tags"])
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(1)


def cmd_stash():
    """Stash working tree changes."""
    result = run(["git", "stash"])
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(1)


def cmd_stash_pop():
    """Restore stashed changes."""
    result = run(["git", "stash", "pop"])
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(1)


COMMANDS = {
    "check-status": cmd_check_status,
    "last-tag": cmd_last_tag,
    "commits-since": cmd_commits_since,
    "delete-tag": cmd_delete_tag,
    "delete-remote-tag": cmd_delete_remote_tag,
    "create-tag": cmd_create_tag,
    "push": cmd_push,
    "stash": cmd_stash,
    "stash-pop": cmd_stash_pop,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(f"Usage: publish-git.py <{'|'.join(COMMANDS)}>", file=sys.stderr)
        sys.exit(1)
    COMMANDS[sys.argv[1]]()


if __name__ == "__main__":
    main()
