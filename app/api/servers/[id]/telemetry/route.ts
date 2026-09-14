import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return Response.json({ error: "Missing server id" }, { status: 400 });

  // This endpoint is intentionally server-side. Add Auth0 session/JWT authorization
  // here before exposing it in production to ensure the caller owns the server.
  const supabase = getSupabaseAdmin();
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 30), 100);

  const [{ data: server, error: serverError }, { data: metrics, error: metricsError }, { data: processes, error: processesError }, { data: logs, error: logsError }, { data: errors, error: errorsError }] = await Promise.all([
    supabase.from("servers").select("id,name,host,status,last_seen_at,created_at").eq("id", id).single(),
    supabase.from("metrics").select("recorded_at,cpu_percent,memory_percent,gpu_percent,disk_percent,download_mbps,upload_mbps,uptime_seconds").eq("server_id", id).order("recorded_at", { ascending: false }).limit(limit),
    supabase.from("processes").select("recorded_at,pid,name,cpu_percent,memory_mb").eq("server_id", id).order("recorded_at", { ascending: false }).limit(100),
    supabase.from("logs").select("id,created_at,level,source,message").eq("server_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("errors").select("id,created_at,resolved_at,severity,code,message").eq("server_id", id).order("created_at", { ascending: false }).limit(100),
  ]);

  if (serverError) return Response.json({ error: serverError.message }, { status: 404 });
  const firstError = metricsError || processesError || logsError || errorsError;
  if (firstError) return Response.json({ error: firstError.message }, { status: 500 });

  return Response.json({
    server,
    metrics: metrics ?? [],
    processes: processes ?? [],
    logs: logs ?? [],
    errors: errors ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}
