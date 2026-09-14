# ServerMonitor agent

The agent is a small Python process that runs on a server you own or administer and reports system telemetry to the ServerMonitor API.

## Current telemetry

- CPU utilization and CPU counts
- RAM utilization and totals
- NVIDIA GPU utilization when `nvidia-smi` is available
- Disk usage
- Uptime
- Network download/upload rate
- Top processes by CPU/memory
- Hostname and OS information

The agent does **not** collect passwords, browser data, or file contents.

## Local test

```powershell
python -m pip install psutil
python monitor_agent.py
```

Without `SERVERMONITOR_API_URL`, the agent prints JSON telemetry locally. Set `SERVERMONITOR_API_URL` and `SERVERMONITOR_AGENT_TOKEN` when the API endpoint is implemented.

```powershell
$env:SERVERMONITOR_INTERVAL="5"
$env:SERVERMONITOR_API_URL="https://your-app.example/api/telemetry"
$env:SERVERMONITOR_AGENT_TOKEN="your-enrollment-token"
python monitor_agent.py
```
