import { auth0 } from "../../../../../../../lib/auth0";
import { getSupabaseAdmin } from "../../../../../../../lib/supabase-admin";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; errorId: string }> }) {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id, errorId } = await params;
  if (!id || !errorId) return Response.json({ error: "Missing server or error id" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data: server } = await supabase.from("servers").select("id").eq("id", id).eq("owner_id", session.user.sub).single();
  if (!server) return Response.json({ error: "Server not found" }, { status: 404 });
  const { data, error } = await supabase.from("errors").update({ resolved_at: new Date().toISOString() }).eq("id", errorId).eq("server_id", id).is("resolved_at", null).select("id,resolved_at").single();
  if (error || !data) return Response.json({ error: error?.message || "Error not found or already resolved" }, { status: 404 });
  return Response.json({ ok: true, error: data });
}
