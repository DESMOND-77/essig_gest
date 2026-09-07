import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("../auth/AuthContext", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));

import { apiFetch } from "../api/client";
import { ToastProvider } from "../components/ToastProvider";
import { routesPersonnes } from "./routes";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  useAuthMock.mockReset().mockReturnValue({ utilisateur: { roles: [{ code: "LECTURE" }] } });
  apiFetchMock.mockReset().mockResolvedValue(
    new Response(
      JSON.stringify({
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 1, matricule: "ESSIG-FCVGUDE1", nom: "N", prenoms: "P", sexe: "F" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("routes personnes", () => {
  it("câble personnes/etudiants, :id, types-piece, inscriptions, pieces-dossier", () => {
    expect(routesPersonnes[0].path).toBe("personnes");
    const segs = routesPersonnes[0].children!.map((r) => r.path);
    expect(segs).toContain("etudiants");
    expect(segs).toContain("types-piece");
    expect(segs).toContain("inscriptions");
    expect(segs).toContain("pieces-dossier");
  });

  it("rend la liste des étudiants depuis l'API mockée", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <ToastProvider>
              <Outlet />
            </ToastProvider>
          ),
          children: routesPersonnes,
        },
      ],
      { initialEntries: ["/personnes/etudiants"] },
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("ESSIG-FCVGUDE1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Étudiants" })).toBeInTheDocument();
  });
});
