import { supabase } from "./supabase";
import { getApiBaseUrl } from "./apiBase";

export async function syncAuthenticatedUser(role, accessTokenOverride) {
  const baseUrl = getApiBaseUrl();
  const accessToken = accessTokenOverride || (await supabase.auth.getSession()).data.session?.access_token;

  if (!accessToken) {
    throw new Error("Missing access token for user sync.");
  }

  const res = await fetch(`${baseUrl}/auth/session-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ role }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.detail || "Failed to sync authenticated user.");
  }

  return payload;
}
