# Server Monitor

A Next.js server monitoring dashboard using Auth0, Supabase, and lightweight Windows/Linux monitoring agents.

## Current flow

1. Sign in with Auth0.
2. Open **Add server** and create an enrollment.
3. Choose Windows or Linux and a 5/10/30 second collection interval.
4. Copy the one-time installer command shown by the app and run it on a machine you own or administer.
5. The agent authenticates with a server-specific bearer credential and sends telemetry to `/api/agent/heartbeat`.
6. Open the server dashboard to view live CPU, memory, GPU, disk, network, processes, system information, logs, and errors.
7. Use **Settings** to rename/edit a server, change its collection interval, rotate its agent credential, or delete it.

## Windows agent

The recommended setup is the generated command from **Add server**, which uses `agent/install_windows.ps1`. The installer stores its configuration under `C:\ProgramData\ServerMonitor`, restricts access to SYSTEM and local Administrators, and registers the agent as a Windows Scheduled Task running as SYSTEM.

For a manual run from `agent/`:

```powershell
pip install psutil requests
python windows_monitor.py --server-id <SERVER_ID> --token <SECRET> --url https://YOUR-DOMAIN/api/agent/heartbeat --interval 5
```

## Linux agent

The generated Linux command uses `agent/install_linux.sh`. It creates a dedicated `server-monitor` service account, installs an isolated Python environment under `/opt/server-monitor`, stores the credential in a root-owned configuration file, and runs the agent through systemd with restrictive service settings.

For a manual run from `agent/`:

```bash
pip3 install psutil requests
python3 linux_monitor.py --server-id <SERVER_ID> --token <SECRET> --url https://YOUR-DOMAIN/api/agent/heartbeat --interval 5
```

The Linux agent reads recent `journalctl` entries when the service account has permission to access the system journal. If journal access is unavailable, telemetry continues without those log entries.

## Environment

Copy `.env.example` to `.env.local` and configure Auth0 and Supabase. Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code or commit real secrets.

Run `supabase/schema.sql` against the Supabase project before creating servers.

## Security

- Server ownership is checked through the Auth0 session before returning or modifying server data.
- Agent credentials are stored as SHA-256 hashes rather than plaintext secrets.
- Credential rotation immediately invalidates the previous credential.
- The service-role Supabase client is server-side only.
- Heartbeat requests have size and field validation and reject invalid credentials before storing telemetry.
- The agent performs telemetry and read-only log collection; it does not provide remote command execution.
- Use HTTPS for production deployments and keep generated enrollment credentials private.

## Offline detection

`/api/cron/check-offline` marks stale agents offline and creates a single unresolved `SERVER_OFFLINE` error. `vercel.json` schedules the check through Vercel Cron. Actual cron frequency depends on the Vercel plan and its current limits.

## Development

```bash
npm install
npm run dev
```

The CI workflow builds the Next.js application and validates all Python agent files with `py_compile`.
