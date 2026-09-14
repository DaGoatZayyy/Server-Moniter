import { auth0 } from "../../../lib/auth0";
import { auth0ManagementRequest } from "../../../lib/auth0-management";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export async function PATCH(request: Request) {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  const response = await auth0ManagementRequest(`/users/${encodeURIComponent(session.user.sub)}`, {
    method: "PATCH",
    body: JSON.stringify({ email, email_verified: false })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return Response.json({ error: data.message || "Unable to change email" }, { status: response.status });
  return Response.json({ message: "Email updated. Check the new address for a verification email." });
}

export async function DELETE() {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  await supabase.from("profiles").delete().eq("owner_id", session.user.sub);
  await supabase.from("server_groups").delete().eq("owner_id", session.user.sub);
  const { error: serverError } = await supabase.from("servers").delete().eq("owner_id", session.user.sub);
  if (serverError) return Response.json({ error: "Unable to remove application data" }, { status: 500 });
  const response = await auth0ManagementRequest(`/users/${encodeURIComponent(session.user.sub)}`, { method: "DELETE" });
  if (!response.ok && response.status !== 204) return Response.json({ error: "Application data was removed, but Auth0 account deletion failed" }, { status: 502 });
  return Response.json({ ok: true });
}
