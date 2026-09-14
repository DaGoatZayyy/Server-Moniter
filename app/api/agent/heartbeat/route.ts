import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { createHash, timingSafeEqual } from "node:crypto";

const THRESHOLDS = [
  { key: "cpu_percent", code: "RESOURCE_CPU_HIGH", label: "CPU", limit: 90 },
  { key: "memory_percent", code: "RESOURCE_MEMORY_HIGH", label: "Memory", limit: 90 },
  { key: "gpu_percent", code: "RESOURCE_GPU_HIGH", label: "GPU", limit: 95 },
  { key: "disk_percent", code: "RESOURCE_DISK_HIGH", label: "Disk", limit: 90 },
] as const;

function validSecret(provided: string, stored: string | null) {
  if (!stored) return false;
  const a = Buffer.from(createHash("sha256").update(provided).digest("hex"));
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

function finiteMetric(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boundedMetric(value: unknown, min: number, max: number) {
  return Math.min(Math.max(finiteMetric(value), min), max);
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return Response.json({ error: "Missing agent token" }, { status: 401 });
  const token = authorization.slice(7).trim();
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const serverId = String(body.server_id ?? "");
  if (!serverId || !token) return Response.json({ error: "server_id and token are required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: server, error: lookupError } = await supabase
    .from("servers")
    .select("id,agent_secret_hash")
    .eq("id", serverId)
    .single();
  if (lookupError || !server || !validSecret(token, server.agent_secret_hash)) {
    return Response.json({ error: "Invalid agent credentials" }, { status: 401 });
  }

  const metrics = body.metrics ?? {};
  const normalizedMetrics = {
    server_id: server.id,
    cpu_percent: boundedMetric(metrics.cpu_percent, 0, 100),
    memory_percent: boundedMetric(metrics.memory_percent, 0, 100),
    gpu_percent: boundedMetric(metrics.gpu_percent, 0, 100),
    disk_percent: boundedMetric(metrics.disk_percent, 0, 100),
    download_mbps: boundedMetric(metrics.download_mbps, 0, Number.MAX_SAFE_INTEGER),
    upload_mbps: boundedMetric(metrics.upload_mbps, 0, Number.MAX_SAFE_INTEGER),
    uptime_seconds: Math.max(0, Math.floor(finiteMetric(metrics.uptime_seconds))),
  };

  const { error: metricError } = await supabase.from("metrics").insert(normalizedMetrics);
  if (metricError) return Response.json({ error: metricError.message }, { status: 500 });

  if (Array.isArray(body.processes) && body.processes.length) {
    await supabase.from("processes").insert(body.processes.slice(0, 100).map((p: any) => ({
      server_id: server.id,
      pid: Math.max(0, Math.floor(finiteMetric(p.pid))),
      name: String(p.name ?? "unknown").slice(0, 200),
      cpu_percent: boundedMetric(p.cpu_percent, 0, 100),
      memory_mb: boundedMetric(p.memory_mb, 0, Number.MAX_SAFE_INTEGER),
    })));
  }

  if (Array.isArray(body.logs) && body.logs.length) {
    await supabase.from("logs").insert(body.logs.slice(0, 50).map((l: any) => ({
      server_id: server.id,
      level: ["info", "warn", "error"].includes(l.level) ? l.level : "info",
      source: String(l.source ?? "agent").slice(0, 100),
      message: String(l.message ?? "").slice(0, 2000),
    })));
  }

  if (Array.isArray(body.errors) && body.errors.length) {
    await supabase.from("errors").insert(body.errors.slice(0, 25).map((e: any) => ({
      server_id: server.id,
      severity: String(e.severity ?? "error").slice(0, 50),
      code: String(e.code ?? "").slice(0, 100),
      message: String(e.message ?? "").slice(0, 2000),
    })));
  }

  // Create one unresolved alert per resource type, then auto-resolve it after recovery.
  for (const threshold of THRESHOLDS) {
    const value = normalizedMetrics[threshold.key];
    const { data: existing } = await supabase
      .from("errors")
      .select("id")
      .eq("server_id", server.id)
      .eq("code", threshold.code)
      .is("resolved_at", null)
      .limit(1);

    if (value >= threshold.limit) {
      if (!existing?.length) {
        await supabase.from("errors").insert({
          server_id: server.id,
          severity: "warning",
          code: threshold.code,
          message: `${threshold.label} usage is high at ${value.toFixed(1)}% (threshold ${threshold.limit}%).`,
        });
      }
    } else if (existing?.length) {
      await supabase
        .from("errors")
        .update({ resolved_at: new Date().toISOString() })
        .eq("server_id", server.id)
        .eq("code", threshold.code)
        .is("resolved_at", null);
    }
  }

  const now = new Date().toISOString();
  await supabase.from("servers").update({ status: "online", last_seen_at: now }).eq("id", server.id);
  return Response.json({ ok: true, received_at: now });
}
