import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { createHash, timingSafeEqual } from "node:crypto";

const THRESHOLDS = [
  { key: "cpu_percent", code: "RESOURCE_CPU_HIGH", label: "CPU", limit: 90 },
  { key: "memory_percent", code: "RESOURCE_MEMORY_HIGH", label: "Memory", limit: 90 },
  { key: "gpu_percent", code: "RESOURCE_GPU_HIGH", label: "GPU", limit: 95 },
  { key: "disk_percent", code: "RESOURCE_DISK_HIGH", label: "Disk", limit: 90 },
] as const;

function validSecret(provided: string, stored: string | null) { if (!stored) return false; const a = Buffer.from(createHash("sha256").update(provided).digest("hex")); const b = Buffer.from(stored); return a.length === b.length && timingSafeEqual(a, b); }
function finiteMetric(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function boundedMetric(value: unknown, min: number, max: number) { const number = finiteMetric(value); return number === null ? null : Math.min(Math.max(number, min), max); }

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return Response.json({ error: "Missing agent token" }, { status: 401 });
  const token = authorization.slice(7).trim();
  if (!token || token.length > 512) return Response.json({ error: "Invalid agent token" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_048_576) return Response.json({ error: "Request too large" }, { status: 413 });

  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Invalid request body" }, { status: 400 });
  const serverId = String(body.server_id ?? "");
  if (!serverId || serverId.length > 100) return Response.json({ error: "server_id is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: server, error: lookupError } = await supabase.from("servers").select("id,agent_secret_hash").eq("id", serverId).single();
  if (lookupError || !server || !validSecret(token, server.agent_secret_hash)) return Response.json({ error: "Invalid agent credentials" }, { status: 401 });

  const metrics = body.metrics && typeof body.metrics === "object" ? body.metrics : {};
  const normalizedMetrics = {
    server_id: server.id,
    cpu_percent: boundedMetric(metrics.cpu_percent, 0, 100), memory_percent: boundedMetric(metrics.memory_percent, 0, 100),
    gpu_percent: boundedMetric(metrics.gpu_percent, 0, 100), disk_percent: boundedMetric(metrics.disk_percent, 0, 100),
    download_mbps: boundedMetric(metrics.download_mbps, 0, 1_000_000), upload_mbps: boundedMetric(metrics.upload_mbps, 0, 1_000_000),
    uptime_seconds: (() => { const n = finiteMetric(metrics.uptime_seconds); return n === null ? null : Math.max(0, Math.floor(n)); })(),
  };
  const { error: metricError } = await supabase.from("metrics").insert(normalizedMetrics);
  if (metricError) return Response.json({ error: "Unable to store telemetry" }, { status: 500 });

  if (Array.isArray(body.processes) && body.processes.length) await supabase.from("processes").insert(body.processes.slice(0, 100).map((p: any) => ({ server_id: server.id, pid: Math.max(0, Math.floor(Number.isFinite(Number(p.pid)) ? Number(p.pid) : 0)), name: String(p.name ?? "unknown").slice(0, 200), cpu_percent: boundedMetric(p.cpu_percent, 0, 100), memory_mb: boundedMetric(p.memory_mb, 0, 1_000_000) })));
  if (Array.isArray(body.logs) && body.logs.length) await supabase.from("logs").insert(body.logs.slice(0, 50).map((l: any) => ({ server_id: server.id, level: ["info", "warn", "error"].includes(l.level) ? l.level : "info", source: String(l.source ?? "agent").slice(0, 100), message: String(l.message ?? "").slice(0, 2000) })));
  if (Array.isArray(body.errors) && body.errors.length) await supabase.from("errors").insert(body.errors.slice(0, 25).map((e: any) => ({ server_id: server.id, severity: ["info", "warning", "error", "critical"].includes(e.severity) ? e.severity : "error", code: String(e.code ?? "").slice(0, 100), message: String(e.message ?? "").slice(0, 2000) })));

  for (const threshold of THRESHOLDS) {
    const value = normalizedMetrics[threshold.key];
    if (value === null) continue;
    const { data: existing } = await supabase.from("errors").select("id").eq("server_id", server.id).eq("code", threshold.code).is("resolved_at", null).limit(1);
    if (value >= threshold.limit) {
      if (!existing?.length) await supabase.from("errors").insert({ server_id: server.id, severity: "warning", code: threshold.code, message: `${threshold.label} usage is high at ${value.toFixed(1)}% (threshold ${threshold.limit}%).` });
    } else if (existing?.length) {
      await supabase.from("errors").update({ resolved_at: new Date().toISOString() }).eq("server_id", server.id).eq("code", threshold.code).is("resolved_at", null);
    }
  }

  const system = body.system;
  const systemInfo = system && typeof system === "object" && !Array.isArray(system) ? {
    hostname: String(system.hostname ?? "").slice(0, 255), platform: String(system.platform ?? "").slice(0, 100), release: String(system.release ?? "").slice(0, 255), architecture: String(system.architecture ?? "").slice(0, 100),
    cpu_count: Math.max(0, Math.floor(Number.isFinite(Number(system.cpu_count)) ? Number(system.cpu_count) : 0)), memory_total_mb: Math.max(0, Math.floor(Number.isFinite(Number(system.memory_total_mb)) ? Number(system.memory_total_mb) : 0)),
  } : null;
  const now = new Date().toISOString();
  const { error: serverError } = await supabase.from("servers").update({ status: "online", last_seen_at: now, ...(systemInfo ? { system_info: systemInfo } : {}) }).eq("id", server.id);
  if (serverError) return Response.json({ error: "Unable to update server status" }, { status: 500 });
  return Response.json({ ok: true, received_at: now });
}
