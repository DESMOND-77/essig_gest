import { afterEach, expect, test, vi } from "vitest";
import { apiFetch, setAccessToken } from "./client";

afterEach(() => { setAccessToken(null); vi.restoreAllMocks(); });

test("ajoute le bearer quand un token est présent", async () => {
  setAccessToken("abc");
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  await apiFetch("/auth/moi/");
  const [, init] = fetchMock.mock.calls[0];
  expect((init.headers as Headers).get("Authorization")).toBe("Bearer abc");
});

test("rafraîchit une fois sur 401 puis rejoue", async () => {
  setAccessToken("vieux");
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response("{}", { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ access: "neuf" }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const r = await apiFetch("/auth/moi/");
  expect(await r.json()).toEqual({ ok: true });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[1][0]).toContain("/auth/refresh/");
});
