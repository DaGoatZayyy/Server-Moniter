import { auth0 } from "../../../lib/auth0";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("servers")
    .select("id,name,host,os,status,last_seen_at,created_at")
    .eq("owner_id", session.user.sub)
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const servers = await Promise.all((data ?? []).map(async (server) => {
    const { count, error: countError } = await supabase
      .from("errors")
      .select("id", { count: "exact", head: true })
      .eq("server_id", server.id)
      .is("resolved_at", null);
    if (countError) throw countError;
    return { ...server, active_alerts: count ?? 0 };
  }));

  return Response.json({ servers }, { headers: { "Cache-Control": "no-store" } });
}
