import { auth0 } from "../../../../lib/auth0";

export async function POST() {
  const session = await auth0.getSession();
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const connection = process.env.AUTH0_DATABASE_CONNECTION || "Username-Password-Authentication";
  if (!domain || !clientId) return Response.json({ error: "Auth0 password reset is not configured" }, { status: 500 });
  const response = await fetch(`https://${domain}/dbconnections/change_password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, email: session.user.email, connection }),
    cache: "no-store"
  });
  if (!response.ok) return Response.json({ error: "Unable to send the password reset email" }, { status: 502 });
  return Response.json({ message: "A password reset email has been sent to your verified account email." });
}
