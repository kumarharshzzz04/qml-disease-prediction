#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
One-command launcher for the Hybrid Quantum Disease Predictor.

Starts the QML desktop UI and — if it isn't already running — the FastAPI
backend that serves the quantum committee. Contributors only need:

    python frontend/run_ui.py

The backend is spawned automatically on port 8000 unless something is
already listening there (e.g. you started uvicorn yourself in another
terminal — in that case the existing server is reused, not duplicated).
"""

import atexit
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
API_PORT = 8000
API_URL = f"http://127.0.0.1:{API_PORT}"
HEALTH_URL = f"{API_URL}/health"


def api_is_up(timeout: float = 1.0) -> bool:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=timeout) as resp:
            return resp.status == 200
    except (urllib.error.URLError, urllib.error.HTTPError, OSError):
        return False


def start_api() -> subprocess.Popen:
    print(f"[run_ui] API not detected on port {API_PORT} - starting backend ...")
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
    if proc.poll() is None:  # still running -> we own it, stop it
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


def wait_for_api(proc: subprocess.Popen, timeout_s: float = 90.0) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if proc.poll() is not None:
            print("[run_ui] ERROR: backend process exited early - "
                  "run `python -m uvicorn backend.app:app` manually to see the error.",
                  file=sys.stderr)
            return False
        if api_is_up():
            return True
        time.sleep(0.5)
    print("[run_ui] ERROR: backend did not become healthy in time.", file=sys.stderr)
    return False


def main() -> int:
    os.environ.setdefault("QT_QUICK_CONTROLS_STYLE", "default")

    spawned = None
    if api_is_up():
        print(f"[run_ui] Reusing API already running at {API_URL}")
    else:
        spawned = start_api()
        if not wait_for_api(spawned):
            return 1
        print(f"[run_ui] Backend ready at {API_URL}")

    # Import Qt only after the API check so an API-only failure is readable.
    from PyQt5.QtCore import QUrl
    from PyQt5.QtGui import QGuiApplication
    from PyQt5.QtQml import QQmlApplicationEngine

    app = QGuiApplication(sys.argv)
    # Silence Qt's QSettings/file-dialog warnings (they need an app identity)
    app.setOrganizationName("QuantumHealth")
    app.setApplicationName("Hybrid Quantum Disease Predictor")
    engine = QQmlApplicationEngine()

    qml_file = Path(__file__).with_name("main.qml")
    engine.load(QUrl.fromLocalFile(str(qml_file)))
    if not engine.rootObjects():
        print(f"Failed to load {qml_file}", file=sys.stderr)
        return 1
    return app.exec_()


if __name__ == "__main__":
    sys.exit(main())
