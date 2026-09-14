import { auth0 } from "../../../lib/auth0";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("servers").select("id,name,host,os,status,last_seen_at,created_at").eq("owner_id", session.user.sub).order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ servers: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
