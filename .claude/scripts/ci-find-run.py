#!/usr/bin/env python3
"""
Find the latest GitHub Actions workflow run triggered by a push (tag push).

Usage:
  python3 ci-find-run.py [--owner Sunshine334419520] [--repo flashnote]

Output:
  Prints the run ID of the latest workflow run, or exits with error if none found.
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
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, json.JSONDecodeError) as e:
        print(f"[error] API request failed: {e}", file=sys.stderr)
        return None


def main():
    owner = OWNER
    repo = REPO

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--owner" and i + 1 < len(args):
            owner = args[i + 1]
            i += 2
        elif args[i] == "--repo" and i + 1 < len(args):
            repo = args[i + 1]
            i += 2
        else:
            i += 1

    url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs?event=push&per_page=1"
    data = fetch_json(url)
    if data is None:
        sys.exit(1)

    runs = data.get("workflow_runs", [])
    if not runs:
        print("[error] No workflow runs found", file=sys.stderr)
        sys.exit(1)

    run_id = runs[0]["id"]
    print(run_id)


if __name__ == "__main__":
    main()
