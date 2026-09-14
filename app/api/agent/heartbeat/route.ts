import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { createHash, timingSafeEqual } from "node:crypto";

function validSecret(provided: string, stored: string) {
  const a = Buffer.from(createHash("sha256").update(provided).digest("hex"));
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
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
  const { data: server, error: lookupError } = await supabase.from("servers").select("id,agent_secret_hash").eq("id", serverId).single();
  if (lookupError || !server || !validSecret(token, server.agent_secret_hash)) return Response.json({ error: "Invalid agent credentials" }, { status: 401 });

  const metrics = body.metrics ?? {};
  const { error: metricError } = await supabase.from("metrics").insert({
    server_id: server.id,
    cpu_percent: metrics.cpu_percent,
    memory_percent: metrics.memory_percent,
    gpu_percent: metrics.gpu_percent,
    disk_percent: metrics.disk_percent,
    download_mbps: metrics.download_mbps,
    upload_mbps: metrics.upload_mbps,
    uptime_seconds: metrics.uptime_seconds,
  });

  if (metricError) return Response.json({ error: metricError.message }, { status: 500 });

  if (Array.isArray(body.processes) && body.processes.length) {
    await supabase.from("processes").insert(body.processes.slice(0, 100).map((p: any) => ({
      server_id: server.id, pid: Number(p.pid), name: String(p.name ?? "unknown"), cpu_percent: Number(p.cpu_percent ?? 0), memory_mb: Number(p.memory_mb ?? 0),
    })));
  }

  if (Array.isArray(body.logs) && body.logs.length) {
    await supabase.from("logs").insert(body.logs.slice(0, 50).map((l: any) => ({
      server_id: server.id, level: ["info", "warn", "error"].includes(l.level) ? l.level : "info", source: String(l.source ?? "agent"), message: String(l.message ?? ""),
    })));
  }

  await supabase.from("servers").update({ status: "online", last_seen_at: new Date().toISOString() }).eq("id", server.id);
  return Response.json({ ok: true, received_at: new Date().toISOString() });
}
