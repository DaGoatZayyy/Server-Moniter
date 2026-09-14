import { auth0 } from "../../../../../lib/auth0";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id) return Response.json({ error: "Missing server id" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data: server, error: serverError } = await supabase.from("servers").select("id,name,host,status,last_seen_at,created_at,collection_interval").eq("id", id).eq("owner_id", session.user.sub).single();
  if (serverError || !server) return Response.json({ error: "Server not found" }, { status: 404 });
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit") ?? 30), 1), 100);
  const [{ data: metrics, error: metricsError }, { data: processes, error: processesError }, { data: logs, error: logsError }, { data: errors, error: errorsError }] = await Promise.all([
    supabase.from("metrics").select("recorded_at,cpu_percent,memory_percent,gpu_percent,disk_percent,download_mbps,upload_mbps,uptime_seconds").eq("server_id", id).order("recorded_at", { ascending: false }).limit(limit),
    supabase.from("processes").select("recorded_at,pid,name,cpu_percent,memory_mb").eq("server_id", id).order("recorded_at", { ascending: false }).limit(100),
    supabase.from("logs").select("id,created_at,level,source,message").eq("server_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("errors").select("id,created_at,resolved_at,severity,code,message").eq("server_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  const dbError = metricsError || processesError || logsError || errorsError;
  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  const lastSeen = server.last_seen_at ? Date.parse(server.last_seen_at) : 0;
  const staleMs = Math.max(15000, server.collection_interval * 3000);
  const status = lastSeen && Date.now() - lastSeen > staleMs ? "offline" : server.status;
  return Response.json({ server: { ...server, status }, metrics: metrics ?? [], processes: processes ?? [], logs: logs ?? [], errors: errors ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
