"""ServerMonitor Windows agent.

Collects local telemetry for a machine the operator owns/administers.
It intentionally does not collect passwords, browser data, or file contents.

Install dependency: python -m pip install psutil
Run: python monitor_agent.py
"""

from __future__ import annotations

import json
import os
import platform
import socket
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import psutil

INTERVAL = float(os.getenv("SERVERMONITOR_INTERVAL", "5"))
API_URL = os.getenv("SERVERMONITOR_API_URL", "")
AGENT_TOKEN = os.getenv("SERVERMONITOR_AGENT_TOKEN", "")


def gpu_usage() -> float | None:
    """Return NVIDIA GPU utilization when nvidia-smi is available."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=2, check=True,
        )
        values = [float(line.strip()) for line in result.stdout.splitlines() if line.strip()]
        return round(max(values), 1) if values else None
    except (FileNotFoundError, subprocess.SubprocessError, ValueError):
        return None


def network_rates(previous: tuple[int, int] | None) -> tuple[dict[str, float], tuple[int, int]]:
    counters = psutil.net_io_counters()
    current = (counters.bytes_recv, counters.bytes_sent)
    if previous is None:
        return {"download_mbps": 0.0, "upload_mbps": 0.0}, current
    down = (current[0] - previous[0]) * 8 / 1_000_000 / INTERVAL
    up = (current[1] - previous[1]) * 8 / 1_000_000 / INTERVAL
    return {"download_mbps": round(max(down, 0), 2), "upload_mbps": round(max(up, 0), 2)}, current


def top_processes(limit: int = 10) -> list[dict]:
    rows = []
    for proc in psutil.process_iter(["pid", "name", "memory_info", "cpu_percent"]):
        try:
            info = proc.info
            memory = info.get("memory_info")
            rows.append({
                "pid": info["pid"],
                "name": info.get("name") or "unknown",
                "cpu_percent": round(float(info.get("cpu_percent") or 0), 1),
                "memory_mb": round((memory.rss if memory else 0) / 1024 / 1024, 1),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return sorted(rows, key=lambda row: (row["cpu_percent"], row["memory_mb"]), reverse=True)[:limit]


def collect(previous_net: tuple[int, int] | None) -> tuple[dict, tuple[int, int]]:
    net, current_net = network_rates(previous_net)
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage(Path.home().anchor or "C:\\")
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "hostname": socket.gethostname(),
        "os": platform.system(),
        "os_version": platform.version(),
        "architecture": platform.machine(),
        "cpu_percent": round(psutil.cpu_percent(interval=None), 1),
        "cpu_count": psutil.cpu_count(logical=False),
        "logical_cpu_count": psutil.cpu_count(logical=True),
        "memory_percent": round(vm.percent, 1),
        "memory_used_bytes": vm.used,
        "memory_total_bytes": vm.total,
        "gpu_percent": gpu_usage(),
        "disk_percent": round(disk.percent, 1),
        "disk_used_bytes": disk.used,
        "disk_total_bytes": disk.total,
        "uptime_seconds": int(time.time() - psutil.boot_time()),
        "network": net,
        "processes": top_processes(),
    }
    return payload, current_net


def send(payload: dict) -> None:
    if not API_URL:
        print(json.dumps(payload, separators=(",", ":")))
        return
    import urllib.request

    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(API_URL, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {AGENT_TOKEN}",
    })
    with urllib.request.urlopen(request, timeout=5) as response:
        if response.status >= 300:
            raise RuntimeError(f"telemetry API returned HTTP {response.status}")


def main() -> None:
    previous_net = None
    psutil.cpu_percent(interval=None)
    print(f"ServerMonitor agent started on {socket.gethostname()} (interval={INTERVAL:g}s)")
    while True:
        started = time.monotonic()
        try:
            payload, previous_net = collect(previous_net)
            send(payload)
        except Exception as exc:
            print(f"agent error: {exc}")
        time.sleep(max(0.1, INTERVAL - (time.monotonic() - started)))


if __name__ == "__main__":
    main()
