"""ServerMonitor Windows agent."""
import argparse
import json
import platform
import socket
import subprocess
import time
from pathlib import Path

import psutil
import requests


def gpu_percent():
    try:
        output = subprocess.check_output(["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"], text=True, timeout=3)
        values = [float(x.strip()) for x in output.splitlines() if x.strip()]
        return max(0.0, min(100.0, max(values))) if values else 0.0
    except (FileNotFoundError, subprocess.SubprocessError, ValueError): return 0.0


def windows_events(seen_ids):
    script = r'''$events = @(); foreach ($log in @("System","Application")) { try { $events += Get-WinEvent -LogName $log -MaxEvents 20 -ErrorAction SilentlyContinue | ForEach-Object { [PSCustomObject]@{ RecordId=$_.RecordId; LogName=$_.LogName; Provider=$_.ProviderName; Id=$_.Id; Level=$_.Level; LevelName=$_.LevelDisplayName; Time=$_.TimeCreated.ToString("o"); Message=if ($_.Message) { $_.Message } else { "" } } } } catch {} }; $events | ConvertTo-Json -Compress -Depth 3'''
    try:
        output = subprocess.check_output(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script], text=True, timeout=8, stderr=subprocess.DEVNULL)
        if not output.strip(): return [], [], seen_ids
        raw = json.loads(output)
        if isinstance(raw, dict): raw = [raw]
        logs, errors = [], []
        for event in raw:
            record_id = str(event.get("RecordId", "")); log_name = str(event.get("LogName", "Windows")); provider = str(event.get("Provider", "Event Viewer")); message = str(event.get("Message", "")).strip()[:2000]
            event_key = f"{log_name}:{record_id}"
            if not record_id or event_key in seen_ids or not message: continue
            seen_ids.add(event_key); level = str(event.get("LevelName", "Information") or "Information").lower()
            if level in ("error", "critical"):
                logs.append({"level":"error","source":f"{log_name}/{provider}","message":f"Event {event.get('Id')}: {message}"}); errors.append({"severity":"critical" if level == "critical" else "error","code":f"{log_name}:{event.get('Id')}","message":message})
            elif level in ("warning", "warn"):
                logs.append({"level":"warn","source":f"{log_name}/{provider}","message":f"Event {event.get('Id')}: {message}"})
            else: logs.append({"level":"info","source":f"{log_name}/{provider}","message":f"Event {event.get('Id')}: {message}"})
        if len(seen_ids) > 500: seen_ids.clear()
        return logs[-50:], errors[-25:], seen_ids
    except (subprocess.SubprocessError, OSError, ValueError, json.JSONDecodeError): return [], [], seen_ids


def process_snapshot():
    processes = list(psutil.process_iter(["pid", "name", "memory_info"]))
    for p in processes:
        try: p.cpu_percent(None)
        except (psutil.NoSuchProcess, psutil.AccessDenied): pass
    time.sleep(0.1)
    rows = []
    for p in processes:
        try:
            info = p.info; mem = info["memory_info"]
            rows.append({"pid": info["pid"], "name": info["name"] or "unknown", "cpu_percent": round(p.cpu_percent(None), 1), "memory_mb": round((mem.rss if mem else 0) / 1024 / 1024, 1)})
        except (psutil.NoSuchProcess, psutil.AccessDenied): pass
    rows.sort(key=lambda p: p["cpu_percent"], reverse=True); return rows[:25]


def snapshot(previous_net, previous_time, server_id, seen_event_ids):
    now = time.monotonic(); net = psutil.net_io_counters(); elapsed = max(now - previous_time, 0.001)
    down = max(0, net.bytes_recv - previous_net.bytes_recv) * 8 / elapsed / 1_000_000; up = max(0, net.bytes_sent - previous_net.bytes_sent) * 8 / elapsed / 1_000_000
    logs, errors, seen_event_ids = windows_events(seen_event_ids)
    return {"server_id": server_id, "system": {"hostname": socket.gethostname(), "platform": platform.system(), "release": platform.release(), "architecture": platform.machine(), "cpu_count": psutil.cpu_count(logical=True) or 0, "memory_total_mb": int(psutil.virtual_memory().total / 1024 / 1024)}, "metrics": {"cpu_percent": psutil.cpu_percent(interval=0.5), "memory_percent": psutil.virtual_memory().percent, "gpu_percent": gpu_percent(), "disk_percent": psutil.disk_usage(Path.home().anchor or "C:\\").percent, "download_mbps": round(down, 2), "upload_mbps": round(up, 2), "uptime_seconds": int(time.time() - psutil.boot_time())}, "processes": process_snapshot(), "logs": logs, "errors": errors}, net, now, seen_event_ids


def load_config(path):
    with open(path, "r", encoding="utf-8") as f: config = json.load(f)
    for key in ("server_id", "token", "url"):
        if not str(config.get(key, "")).strip(): raise ValueError(f"Missing config value: {key}")
    config["interval"] = max(1, int(config.get("interval", 5))); return config


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--server-id"); parser.add_argument("--token"); parser.add_argument("--url"); parser.add_argument("--interval", type=int, default=5); parser.add_argument("--config"); args = parser.parse_args()
    if args.config:
        config = load_config(args.config); server_id, token, url, interval = config["server_id"], config["token"], config["url"], config["interval"]
    else:
        if not all((args.server_id, args.token, args.url)): parser.error("--server-id, --token and --url are required unless --config is used")
        server_id, token, url, interval = args.server_id, args.token, args.url, max(1, args.interval)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}; previous_net = psutil.net_io_counters(); previous_time = time.monotonic(); connected = False; seen_event_ids = set()
    while True:
        payload, previous_net, previous_time, seen_event_ids = snapshot(previous_net, previous_time, server_id, seen_event_ids)
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10); response.raise_for_status()
            if not connected: print(f"connected: {socket.gethostname()}"); connected = True
        except requests.RequestException as exc: connected = False; print(f"heartbeat failed: {exc}")
        time.sleep(interval)


if __name__ == "__main__": main()
