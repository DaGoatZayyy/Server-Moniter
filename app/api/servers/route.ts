import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { randomBytes, createHash } from "node:crypto";

export async function POST(request: Request) {
  // Auth0 session/JWT ownership validation should be enforced here before production use.
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = String(body.name ?? "").trim();
  const host = String(body.host ?? "").trim();
  const os = String(body.os ?? "windows");
  const interval = Math.max(5, Math.min(300, Number(body.interval ?? 5)));
  if (!name || !host) return Response.json({ error: "name and host are required" }, { status: 400 });

  const secret = randomBytes(32).toString("base64url");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("servers").insert({
    owner_id: String(body.owner_id ?? "pending-auth0-user"), name, host, os, collection_interval: interval,
    agent_secret_hash: createHash("sha256").update(secret).digest("hex"),
  }).select("id,name,host,agent_id,collection_interval").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ server: data, enrollment_token: secret }, { status: 201 });
}
