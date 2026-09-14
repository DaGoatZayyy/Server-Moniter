import { auth0 } from "../../../../lib/auth0";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

async function ownedServer(id: string, ownerId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("servers").select("id,name,host,os,collection_interval,status,last_seen_at,created_at,agent_id").eq("id", id).eq("owner_id", ownerId).single();
  return { supabase, data, error };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id) return Response.json({ error: "Missing server id" }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) { const name = String(body.name).trim(); if (!name || name.length > 100) return Response.json({ error: "Name must be 1-100 characters" }, { status: 400 }); updates.name = name; }
  if (body.host !== undefined) { const host = String(body.host).trim(); if (!host || host.length > 253) return Response.json({ error: "Host must be 1-253 characters" }, { status: 400 }); updates.host = host; }
  if (body.os !== undefined) { const os = String(body.os).trim().toLowerCase(); if (!["windows", "linux"].includes(os)) return Response.json({ error: "Invalid operating system" }, { status: 400 }); updates.os = os; }
  if (body.collection_interval !== undefined) { const interval = Number(body.collection_interval); if (!Number.isInteger(interval) || ![5, 10, 30].includes(interval)) return Response.json({ error: "Invalid collection interval" }, { status: 400 }); updates.collection_interval = interval; }
  if (!Object.keys(updates).length) return Response.json({ error: "No changes supplied" }, { status: 400 });
  const { supabase, data: server, error: lookupError } = await ownedServer(id, session.user.sub);
  if (lookupError || !server) return Response.json({ error: "Server not found" }, { status: 404 });
  const { data, error } = await supabase.from("servers").update(updates).eq("id", id).eq("owner_id", session.user.sub).select("id,name,host,os,collection_interval,status,last_seen_at,created_at,agent_id").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ server: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!id) return Response.json({ error: "Missing server id" }, { status: 400 });
  const { supabase, data: server, error: lookupError } = await ownedServer(id, session.user.sub);
  if (lookupError || !server) return Response.json({ error: "Server not found" }, { status: 404 });
  const { error } = await supabase.from("servers").delete().eq("id", id).eq("owner_id", session.user.sub);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
