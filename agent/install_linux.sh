#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="/opt/server-monitor"; STATE_DIR="/var/lib/server-monitor"; SERVICE_USER="server-monitor"; SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${EUID}" -ne 0 ]]; then echo "Run this installer as root (for example: sudo bash install_linux.sh)." >&2; exit 1; fi
: "${SERVER_ID:?Set SERVER_ID to the server ID from the ServerMonitor dashboard}"; : "${TOKEN:?Set TOKEN to the one-time enrollment secret}"; : "${URL:?Set URL to the full /api/agent/heartbeat endpoint}"; INTERVAL="${INTERVAL:-5}"
if ! [[ "$INTERVAL" =~ ^[0-9]+$ ]] || (( INTERVAL < 1 )); then echo "INTERVAL must be a positive integer." >&2; exit 1; fi
id "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
install -d -o root -g "$SERVICE_USER" -m 0750 "$INSTALL_DIR"; install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0750 "$STATE_DIR"; install -o root -g root -m 0755 "$SCRIPT_DIR/linux_monitor.py" "$INSTALL_DIR/linux_monitor.py"
python3 -m venv "$INSTALL_DIR/venv"; "$INSTALL_DIR/venv/bin/python" -m pip install --disable-pip-version-check --upgrade psutil requests
cat > "$INSTALL_DIR/agent.json" <<EOF
{"server_id":"${SERVER_ID}","token":"${TOKEN}","url":"${URL}","interval":${INTERVAL}}
EOF
chown root:"$SERVICE_USER" "$INSTALL_DIR/agent.json"; chmod 0640 "$INSTALL_DIR/agent.json"
cat > /etc/systemd/system/server-monitor.service <<EOF
[Unit]
Description=ServerMonitor telemetry agent
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/venv/bin/python $INSTALL_DIR/linux_monitor.py --config $INSTALL_DIR/agent.json --state $STATE_DIR/state.json
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
LockPersonality=true
RestrictRealtime=true
RestrictSUIDSGID=true
MemoryDenyWriteExecute=true
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload; systemctl enable --now server-monitor.service
echo "ServerMonitor Linux agent installed and started."; echo "Check status: sudo systemctl status server-monitor"; echo "View agent logs: sudo journalctl -u server-monitor -f"
