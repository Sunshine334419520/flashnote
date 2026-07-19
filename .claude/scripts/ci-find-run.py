#!/usr/bin/env python3
"""
Find the latest GitHub Actions workflow run triggered by a push (tag push).

Usage:
  python3 ci-find-run.py [--workflow <name>] [--owner O] [--repo R]

Options:
  --workflow <name>  Filter by workflow file name (e.g. "release", "ci").
                     Looks for <name>.yml in .github/workflows/.
                     Without this flag, searches across all workflows.

Output:
  Prints the run ID of the latest matching workflow run, or exits with error.
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
    workflow = None

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--owner" and i + 1 < len(args):
            owner = args[i + 1]
            i += 2
        elif args[i] == "--repo" and i + 1 < len(args):
            repo = args[i + 1]
            i += 2
        elif args[i] == "--workflow" and i + 1 < len(args):
            workflow = args[i + 1]
            i += 2
        else:
            i += 1

    if workflow:
        # Filter by specific workflow file — precise, avoids other workflows
        wf_file = f"{workflow}.yml" if not workflow.endswith(".yml") else workflow
        url = f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{wf_file}/runs?event=push&per_page=1"
    else:
        # Search across all workflows (original behavior)
        url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs?event=push&per_page=1"

    data = fetch_json(url)
    if data is None:
        sys.exit(1)

    runs = data.get("workflow_runs", [])
    if not runs:
        name_hint = f" workflow '{workflow}'" if workflow else ""
        print(f"[error] No{name_hint} runs found", file=sys.stderr)
        sys.exit(1)

    run_id = runs[0]["id"]
    print(run_id)


if __name__ == "__main__":
    main()
