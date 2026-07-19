#!/usr/bin/env python3
"""
Check if a GitHub release has been published for a given tag.

Usage:
  python3 ci-check-release.py <tag> [--owner Sunshine334419520] [--repo flashnote]

Output:
  Prints the release URL if found, or exits with error if not.
"""

import json
import sys
import urllib.request
import urllib.error

OWNER = "Sunshine334419520"
REPO = "flashnote"


def fetch_json(url: str) -> dict | None:
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"[error] API request failed: {e}", file=sys.stderr)
        return None
    except (urllib.error.URLError, OSError, json.JSONDecodeError) as e:
        print(f"[error] API request failed: {e}", file=sys.stderr)
        return None


def main():
    args = sys.argv[1:]
    if not args:
        print("Usage: ci-check-release.py <tag> [--owner O] [--repo R]", file=sys.stderr)
        sys.exit(1)

    tag = args[0]
    owner = OWNER
    repo = REPO

    i = 1
    while i < len(args):
        if args[i] == "--owner" and i + 1 < len(args):
            owner = args[i + 1]
            i += 2
        elif args[i] == "--repo" and i + 1 < len(args):
            repo = args[i + 1]
            i += 2
        else:
            i += 1

    url = f"https://api.github.com/repos/{owner}/{repo}/releases/tags/{tag}"
    data = fetch_json(url)
    if data is None:
        print("[error] Release not found for tag", tag, file=sys.stderr)
        sys.exit(1)

    html_url = data.get("html_url", "")
    if html_url:
        print(html_url)
    else:
        print(f"https://github.com/{owner}/{repo}/releases/tag/{tag}")


if __name__ == "__main__":
    main()
