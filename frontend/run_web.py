#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
One-command launcher for the Quemeds web frontend.

Starts the FastAPI backend (if not already running) and opens
the web-based UI in the default browser. Contributors only need:

    python frontend/run_web.py

The backend is spawned automatically on port 8000 unless something
is already listening there.
"""

import atexit
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = Path(__file__).resolve().parent
API_PORT = 8000
API_URL = f"http://127.0.0.1:{API_PORT}"
HEALTH_URL = f"{API_URL}/health"
FRONTEND_URL = str(FRONTEND_DIR / "index.html")


def api_is_up(timeout: float = 1.0) -> bool:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=timeout) as resp:
            return resp.status == 200
    except (urllib.error.URLError, urllib.error.HTTPError, OSError):
        return False


def start_api() -> subprocess.Popen:
    print(f"[run_web] API not detected on port {API_PORT} — starting backend...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.app:app", "--port", str(API_PORT)],
        cwd=str(PROJECT_ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    atexit.register(_stop_api, proc)
    return proc


def _stop_api(proc: subprocess.Popen) -> None:
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


def wait_for_api(proc: subprocess.Popen, timeout_s: float = 90.0) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if proc.poll() is not None:
            print(
                "[run_web] ERROR: backend process exited early — "
                "run `python -m uvicorn backend.app:app` manually to see the error.",
                file=sys.stderr,
            )
            return False
        if api_is_up():
            return True
        time.sleep(0.5)
    print("[run_web] ERROR: backend did not become healthy in time.", file=sys.stderr)
    return False


def main() -> int:
    spawned = None
    if api_is_up():
        print(f"[run_web] Reusing API already running at {API_URL}")
    else:
        spawned = start_api()
        if not wait_for_api(spawned):
            return 1
        print(f"[run_web] Backend ready at {API_URL}")

    # Open the web UI in the default browser
    print(f"[run_web] Opening Quemeds in browser...")
    webbrowser.open(FRONTEND_URL)

    if spawned:
        print(f"[run_web] Backend running on port {API_PORT}. Press Ctrl+C to stop.")
        try:
            spawned.wait()
        except KeyboardInterrupt:
            print("\n[run_web] Shutting down...")
            _stop_api(spawned)
    else:
        print("[run_web] Using existing backend. Frontend opened in browser.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
