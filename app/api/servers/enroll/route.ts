import { auth0 } from "../../../../lib/auth0";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { randomBytes, createHash } from "node:crypto";

export async function POST(request: Request) {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) return Response.json({ error: "Request too large" }, { status: 413 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = String(body.name ?? "").trim();
  const host = String(body.host ?? "").trim();
  const os = String(body.os ?? "windows").trim().toLowerCase();
  const interval = Number(body.interval ?? 5);
  if (!name || !host) return Response.json({ error: "Name and host are required" }, { status: 400 });
  if (name.length > 100) return Response.json({ error: "Name must be 100 characters or fewer" }, { status: 400 });
  if (host.length > 253) return Response.json({ error: "Host must be 253 characters or fewer" }, { status: 400 });
  if (!["windows", "linux"].includes(os)) return Response.json({ error: "Operating system must be Windows or Linux" }, { status: 400 });
  if (!Number.isInteger(interval) || ![5, 10, 30].includes(interval)) return Response.json({ error: "Invalid interval" }, { status: 400 });

  const secret = randomBytes(32).toString("hex");
  const secretHash = createHash("sha256").update(secret).digest("hex");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("servers").insert({ owner_id: session.user.sub, name, host, os, collection_interval: interval, agent_secret_hash: secretHash, status: "offline" }).select("id,agent_id,name,host,os,collection_interval").single();
  if (error) return Response.json({ error: "Unable to create server" }, { status: 500 });
  return Response.json({ server: data, enrollment_code: `${data.id}.${secret}` });
}
