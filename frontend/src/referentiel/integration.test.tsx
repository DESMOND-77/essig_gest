import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("../auth/AuthContext", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));

import { apiFetch } from "../api/client";
import { ToastProvider } from "../components/ToastProvider";
import { routesReferentiel } from "./routes";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

function pageRep(results: Record<string, unknown>[]) {
  return new Response(
    JSON.stringify({ count: results.length, next: null, previous: null, results }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

beforeEach(() => {
  useAuthMock.mockReset().mockReturnValue({ utilisateur: { roles: [{ code: "LECTURE" }] } });
  apiFetchMock.mockReset().mockResolvedValue(
    pageRep([
      { id: 1, nom: "ESSIG", sigle: "E", regime: "LMD" },
    ]),
  );
});
afterEach(() => vi.restoreAllMocks());

function monter(chemin: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        ),
        children: routesReferentiel,
      },
    ],
    { initialEntries: [chemin] },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("routes référentiel", () => {
  it("câble les 10 ressources sous le segment /referentiel", () => {
    expect(routesReferentiel).toHaveLength(1);
    expect(routesReferentiel[0].path).toBe("referentiel");
    expect(routesReferentiel[0].children).toHaveLength(10);
    const segments = routesReferentiel[0].children!.map((r) => r.path);
    expect(segments).toContain("ecoles");
    expect(segments).toContain("sessions-examen");
  });

  it("rend la liste des écoles depuis l'API mockée", async () => {
    monter("/referentiel/ecoles");
    expect(await screen.findByText("ESSIG")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Écoles" })).toBeInTheDocument();
  });
});
