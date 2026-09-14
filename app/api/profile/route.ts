import { auth0 } from "../../../lib/auth0";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("profiles").select("*").eq("owner_id", session.user.sub).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({
    profile: data ?? {
      owner_id: session.user.sub,
      username: session.user.nickname ?? session.user.email?.split("@")[0] ?? "user",
      display_name: session.user.name ?? "",
      bio: "",
      avatar_url: session.user.picture ?? "",
      is_public: false,
      github_username: "",
      github_url: ""
    },
    auth: { email: session.user.email ?? "", email_verified: Boolean(session.user.email_verified), picture: session.user.picture ?? "" }
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const session = await auth0.getSession();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const profile = {
    owner_id: session.user.sub,
    username: clean(body.username, 40).replace(/[^a-zA-Z0-9_.-]/g, ""),
    display_name: clean(body.display_name, 80),
    bio: clean(body.bio, 500),
    avatar_url: clean(body.avatar_url, 500),
    is_public: body.is_public === true,
    github_username: clean(body.github_username, 80),
    github_url: clean(body.github_url, 300),
    updated_at: new Date().toISOString()
  };
  if (!profile.username) return Response.json({ error: "Username is required" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("profiles").upsert(profile).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ profile: data });
}
