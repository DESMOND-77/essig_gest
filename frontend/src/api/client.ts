const BASE = "/api/v1";
let accessToken: string | null = null;

export function setAccessToken(t: string | null) { accessToken = t; }
export function getAccessToken() { return accessToken; }

async function raw(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${BASE}${path}`, { ...init, headers, credentials: "include" });
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  let resp = await raw(path, init);
  if (resp.status !== 401 || path.startsWith("/auth/refresh") || path.startsWith("/auth/login"))
    return resp;

  const refresh = await fetch(`${BASE}/auth/refresh/`, { method: "POST", credentials: "include" });
  if (!refresh.ok) { accessToken = null; return resp; }
  accessToken = (await refresh.json()).access;
  resp = await raw(path, init);
  return resp;
}
