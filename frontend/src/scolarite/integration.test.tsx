import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("../auth/AuthContext", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));

import { apiFetch } from "../api/client";
import { ToastProvider } from "../components/ToastProvider";
import { routesScolarite } from "./routes";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

function rep() {
  return new Response(
    JSON.stringify({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          niveau: 1,
          annee_scolaire: 1,
          montant_inscription_reinscription: "105000",
          nombre_echeance: 9,
          montant_echeance: "70000",
          montant_total: "735000",
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

beforeEach(() => {
  useAuthMock.mockReset().mockReturnValue({ utilisateur: { roles: [{ code: "LECTURE" }] } });
  apiFetchMock.mockReset().mockImplementation(() => Promise.resolve(rep()));
});
afterEach(() => vi.restoreAllMocks());

describe("routes scolarité", () => {
  it("câble modalites-paiement et echeances", () => {
    expect(routesScolarite[0].path).toBe("scolarite");
    const segs = routesScolarite[0].children!.map((r) => r.path);
    expect(segs).toContain("modalites-paiement");
    expect(segs).toContain("echeances");
  });

  it("rend la grille tarifaire depuis l'API mockée", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <ToastProvider>
              <Outlet />
            </ToastProvider>
          ),
          children: routesScolarite,
        },
      ],
      { initialEntries: ["/scolarite/modalites-paiement"] },
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("735000")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Grilles tarifaires" }),
    ).toBeInTheDocument();
  });
});
