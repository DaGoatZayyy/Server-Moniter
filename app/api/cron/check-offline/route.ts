import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";

  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: servers, error } = await supabase
    .from("servers")
    .select("id,name,status,last_seen_at,collection_interval");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  let offline = 0;
  let recovered = 0;

  for (const server of servers ?? []) {
    const lastSeen = server.last_seen_at ? Date.parse(server.last_seen_at) : 0;
    const staleMs = Math.max(15000, Number(server.collection_interval ?? 5) * 3000);
    const isOffline = !lastSeen || now - lastSeen > staleMs;

    if (isOffline) {
      offline += 1;
      await supabase.from("servers").update({ status: "offline" }).eq("id", server.id);

      const { data: existing } = await supabase
        .from("errors")
        .select("id")
        .eq("server_id", server.id)
        .eq("code", "SERVER_OFFLINE")
        .is("resolved_at", null)
        .limit(1);

      if (!existing?.length) {
        await supabase.from("errors").insert({
          server_id: server.id,
          severity: "error",
          code: "SERVER_OFFLINE",
          message: `${server.name} has stopped reporting telemetry.`,
        });
      }
    } else {
      await supabase.from("servers").update({ status: "online" }).eq("id", server.id);

      const { data: existing } = await supabase
        .from("errors")
        .select("id")
        .eq("server_id", server.id)
        .eq("code", "SERVER_OFFLINE")
        .is("resolved_at", null)
        .limit(1);

      if (existing?.length) {
        recovered += 1;
        await supabase
          .from("errors")
          .update({ resolved_at: new Date().toISOString() })
          .eq("server_id", server.id)
          .eq("code", "SERVER_OFFLINE")
          .is("resolved_at", null);
      }
    }
  }

  return Response.json({ ok: true, checked: servers?.length ?? 0, offline, recovered });
}
