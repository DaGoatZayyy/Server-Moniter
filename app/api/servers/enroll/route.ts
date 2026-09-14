import { auth0 } from "../../../../lib/auth0";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { randomBytes, createHash } from "node:crypto";

export async function POST(request: Request) {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const host = String(body.host ?? "").trim();
  const os = String(body.os ?? "windows").trim();
  const interval = Number(body.interval ?? 5);

  if (!name || !host) return Response.json({ error: "Name and host are required" }, { status: 400 });
  if (!Number.isFinite(interval) || ![5, 10, 30].includes(interval)) return Response.json({ error: "Invalid interval" }, { status: 400 });

  const secret = randomBytes(32).toString("hex");
  const secretHash = createHash("sha256").update(secret).digest("hex");
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.from("servers").insert({
    owner_id: session.user.sub,
    name,
    host,
    os,
    collection_interval: interval,
    agent_secret_hash: secretHash,
    status: "offline",
  }).select("id,agent_id,name,host").single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ server: data, enrollment_code: `${data.id}.${secret}` });
}
