"""ServerMonitor Linux agent.

Install: python3 -m pip install psutil requests
Run with the server ID, one-time enrollment secret, and heartbeat URL.
"""
import argparse
import json
import subprocess
import time

import psutil
import requests


_seen_journal_events = set()


def gpu_percent():
    try:
        output = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
            text=True,
            timeout=3,
        )
        values = [float(x.strip()) for x in output.splitlines() if x.strip()]
        return max(0.0, min(100.0, max(values))) if values else 0.0
    except (FileNotFoundError, subprocess.SubprocessError, ValueError):
        return 0.0


def journal_events(limit=20):
    """Read recent systemd journal entries without executing a shell."""
    try:
        output = subprocess.check_output(
            ["journalctl", "-n", str(limit), "--no-pager", "-o", "json"],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return [], []

    logs = []
    errors = []
    for line in output.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue

        cursor = event.get("__CURSOR")
        if not cursor or cursor in _seen_journal_events:
            continue
        _seen_journal_events.add(cursor)

        priority = str(event.get("PRIORITY", "6"))
        level = "error" if priority in {"0", "1", "2", "3"} else "warn" if priority == "4" else "info"
        message = str(event.get("MESSAGE", "")).strip()
        if not message:
            continue

        source = str(event.get("SYSLOG_IDENTIFIER") or event.get("_SYSTEMD_UNIT") or "systemd")
        code = event.get("MESSAGE_ID") or event.get("SYSLOG_IDENTIFIER")
        entry = {"level": level, "source": source, "message": message[:2000]}
        logs.append(entry)

        if level == "error":
            errors.append({
                "severity": "critical" if priority in {"0", "1"} else "error",
                "code": str(code)[:120] if code else None,
                "message": message[:2000],
            })

    # Keep the in-memory set bounded so a long-running agent cannot grow forever.
    if len(_seen_journal_events) > 2000:
        _seen_journal_events.clear()

    return logs[-20:], errors[-20:]


def snapshot(previous_net, previous_time, server_id):
    now = time.monotonic()
    net = psutil.net_io_counters()
    elapsed = max(now - previous_time, 0.001)
    down = max(0, net.bytes_recv - previous_net.bytes_recv) * 8 / elapsed / 1_000_000
    up = max(0, net.bytes_sent - previous_net.bytes_sent) * 8 / elapsed / 1_000_000

    processes = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_info"]):
        try:
            info = p.info
            mem = info["memory_info"]
            processes.append({
                "pid": info["pid"],
                "name": info["name"] or "unknown",
                "cpu_percent": round(info["cpu_percent"] or 0, 1),
                "memory_mb": round((mem.rss if mem else 0) / 1024 / 1024, 1),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    processes.sort(key=lambda p: p["cpu_percent"], reverse=True)

    logs, errors = journal_events()
    return {
        "server_id": server_id,
        "metrics": {
            "cpu_percent": psutil.cpu_percent(interval=0.5),
            "memory_percent": psutil.virtual_memory().percent,
            "gpu_percent": gpu_percent(),
            "disk_percent": psutil.disk_usage("/").percent,
            "download_mbps": round(down, 2),
            "upload_mbps": round(up, 2),
            "uptime_seconds": int(time.time() - psutil.boot_time()),
        },
        "processes": processes[:25],
        "logs": logs,
        "errors": errors,
    }, net, now


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--server-id", required=True)
    parser.add_argument("--token", required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--interval", type=int, default=5)
    args = parser.parse_args()

    interval = max(1, args.interval)
    headers = {"Authorization": f"Bearer {args.token}", "Content-Type": "application/json"}
    previous_net = psutil.net_io_counters()
    previous_time = time.monotonic()
    connected = False

    while True:
        payload, previous_net, previous_time = snapshot(previous_net, previous_time, args.server_id)
        try:
            response = requests.post(args.url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            if not connected:
                print("connected")
                connected = True
        except requests.RequestException as exc:
            connected = False
            print(f"heartbeat failed: {exc}")
        time.sleep(interval)


if __name__ == "__main__":
    main()
