#!/usr/bin/env python3
"""
CI Build Monitor — watch a GitHub Actions workflow run until all jobs complete.

Usage:
  python3 ci-watch.py <run_id> [--owner Sunshine334419520] [--repo flashnote]

Output (one line per event, suitable for Claude's Monitor tool):
  JobName: in_progress (None)
  JobName: completed (success)
  JobName: completed (failure)

Exits 0 when all jobs finish, 1 on any failure.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

OWNER = "Sunshine334419520"
REPO = "flashnote"
POLL_INTERVAL = 30  # seconds


def fetch_json(url: str) -> dict:
    """Fetch a JSON URL. Returns None on transient failure."""
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, urllib.error.HTTPError, OSError, json.JSONDecodeError) as e:
        print(f"[error] API request failed: {e}", file=sys.stderr)
        return None


def get_run_jobs(run_id: str) -> list[dict] | None:
    """Get all jobs for a workflow run."""
    url = f"https://api.github.com/repos/{OWNER}/{REPO}/actions/runs/{run_id}/jobs"
    data = fetch_json(url)
    if data is None:
        return None
    return data.get("jobs", [])


def format_job(job: dict) -> str:
    """Format a job as a status line."""
    name = job["name"]
    status = job["status"]
    conclusion = job.get("conclusion") or "None"
    return f"{name}: {status} ({conclusion})"


def all_done(jobs: list[dict]) -> bool:
    """Check if all jobs have a conclusion."""
    return all(job.get("conclusion") is not None for job in jobs)


def has_failure(jobs: list[dict]) -> bool:
    """Check if any job failed."""
    return any(
        job.get("conclusion") in ("failure", "cancelled", "timed_out")
        for job in jobs if job.get("conclusion")
    )


def main():
    args = sys.argv[1:]
    if not args:
        print("Usage: ci-watch.py <run_id> [--owner O] [--repo R]", file=sys.stderr)
        sys.exit(1)

    run_id = args[0]
    # Allow override via env or args
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

    # Override globals
    globals()["OWNER"] = owner
    globals()["REPO"] = repo

    print(f"[info] Watching run {run_id} for {owner}/{repo}", file=sys.stderr)

    finished_jobs: set[str] = set()

    while True:
        jobs = get_run_jobs(run_id)
        if jobs is None:
            print("[warn] Could not fetch jobs, retrying...", file=sys.stderr)
            time.sleep(POLL_INTERVAL)
            continue

        # Print new/changed job statuses
        for job in jobs:
            job_id = str(job["id"])
            status = job["status"]
            conclusion = job.get("conclusion")

            if status == "completed":
                if job_id not in finished_jobs:
                    finished_jobs.add(job_id)
                    print(format_job(job))
            else:
                # Print in-progress jobs (with dedup by not tracking)
                print(format_job(job))

        if all_done(jobs):
            if has_failure(jobs):
                # Print the final status again for clarity
                print("---")
                for job in jobs:
                    print(format_job(job))
                print("[result] FAILURE — some jobs failed", file=sys.stderr)
                sys.exit(1)
            else:
                print("[result] SUCCESS — all jobs passed", file=sys.stderr)
                sys.exit(0)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
