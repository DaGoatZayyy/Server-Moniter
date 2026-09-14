# Server Monitor

A Next.js server monitoring dashboard using Auth0, Supabase, and lightweight monitoring agents.

## Current flow

1. Sign in with Auth0.
2. Open **Add server** and create an enrollment.
3. Copy the one-time agent command shown by the app.
4. Run the Windows monitoring agent on the machine you own or administer.
5. The agent sends authenticated telemetry to `/api/agent/heartbeat`.
6. Open the server dashboard to view live CPU, memory, GPU, disk, network, processes, logs, and errors.

## Windows agent

From `agent/`:

```powershell
pip install psutil requests
python windows_monitor.py --server-id <SERVER_ID> --token <SECRET> --url https://YOUR-DOMAIN/api/agent/heartbeat
```

Use HTTPS for any deployment outside a trusted local development environment. The raw enrollment secret is displayed only when an enrollment is created; store it securely.

## Environment

Copy `.env.example` to `.env.local` and configure Auth0 and Supabase. Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code or commit real secrets.

Run the Supabase SQL in `supabase/schema.sql` before creating servers.

## Security notes

- Server ownership is checked through the Auth0 session before returning server telemetry.
- Agent credentials are stored as SHA-256 hashes rather than plaintext secrets.
- Agent requests use a server-specific bearer credential.
- The service-role Supabase client is server-side only.
- Production deployments should add rate limiting, monitoring, secret rotation/revocation, and stronger request validation.
