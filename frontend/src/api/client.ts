const BASE = "/api/v1";
let accessToken: string | null = null;

export function setAccessToken(t: string | null) { accessToken = t; }
export function getAccessToken() { return accessToken; }

let pendingRefresh: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  if (!pendingRefresh) {
    pendingRefresh = fetch(`${BASE}/auth/refresh/`, { method: "POST", credentials: "include" })
      .then(async (r) => {
        if (!r.ok) { accessToken = null; return false; }
        accessToken = (await r.json()).access;
        return true;
      })
      .catch(() => { accessToken = null; return false; })
      .finally(() => { pendingRefresh = null; });
  }
  return pendingRefresh;
}

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

  const ok = await refreshOnce();
  if (!ok) return resp;
  resp = await raw(path, init);
  return resp;
}
