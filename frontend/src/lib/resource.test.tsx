import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Interception fiable sous vitest/ESM : on remplace le module client par un
// mock. `vi.spyOn` sur l'export nommé n'intercepte pas de façon garantie ici
// (l'import de resource.ts fige la référence de `apiFetch`).
vi.mock("../api/client", () => ({
  apiFetch: vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [{ id: 1, nom: "X" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  ),
}));

import { apiFetch } from "../api/client";
import { createResourceHooks } from "./resource";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const hooks = createResourceHooks<{ id: number; nom: string }>("referentiel/ecoles");

beforeEach(() => apiFetchMock.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("useListe", () => {
  it("sérialise les params en query string et renvoie la page", async () => {
    const { result } = renderHook(() => hooks.useListe({ page: 2, search: "es", vide: "" }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.count).toBe(1);
    expect(result.current.data?.results[0]).toEqual({ id: 1, nom: "X" });

    const url = apiFetchMock.mock.calls[0][0] as string;
    expect(url).toBe("/referentiel/ecoles/?page=2&search=es");
    expect(url).not.toContain("vide=");
  });
});
