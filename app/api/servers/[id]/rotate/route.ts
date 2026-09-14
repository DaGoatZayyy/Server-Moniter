import { auth0 } from "../../../../../lib/auth0";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { createHash, randomBytes, randomUUID } from "node:crypto";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id) return Response.json({ error: "Missing server id" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data: server, error: lookupError } = await supabase.from("servers").select("id,name,host,os,collection_interval").eq("id", id).eq("owner_id", session.user.sub).single();
  if (lookupError || !server) return Response.json({ error: "Server not found" }, { status: 404 });
  const secret = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(secret).digest("hex");
  const { error } = await supabase.from("servers").update({ agent_secret_hash: hash, agent_id: randomUUID(), status: "offline", last_seen_at: null }).eq("id", id).eq("owner_id", session.user.sub);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ enrollment_code: `${server.id}.${secret}`, server });
}
