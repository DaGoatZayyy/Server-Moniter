let cached: { token: string; expiresAt: number } | null = null;

export async function getAuth0ManagementToken() {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_M2M_CLIENT_ID;
  const clientSecret = process.env.AUTH0_M2M_CLIENT_SECRET;
  if (!domain || !clientId || !clientSecret) throw new Error("Auth0 Management API is not configured");
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const response = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, audience: `https://${domain}/api/v2/` }),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error("Unable to obtain Auth0 Management API token");
  cached = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in ?? 86400) * 1000 };
  return data.access_token as string;
}

export async function auth0ManagementRequest(path: string, init: RequestInit = {}) {
  const domain = process.env.AUTH0_DOMAIN;
  if (!domain) throw new Error("AUTH0_DOMAIN is missing");
  const token = await getAuth0ManagementToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return fetch(`https://${domain}/api/v2${path}`, { ...init, headers, cache: "no-store" });
}
