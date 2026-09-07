import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));
import { apiFetch } from "../api/client";
import { FicheEtudiant } from "./FicheEtudiant";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

function fiche(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      id: 1,
      matricule: "ESSIG-FCVGUDE1",
      nom: "Gumapi clos",
      prenoms: "desmond junior",
      sexe: "F",
      nationalite: "Gabonaise",
      affiliations: [
        { id: 1, type: "PERE", nom: "Gumapi", prenom: "Jean", contact: "01" },
      ],
      situation_bac: { id: 1, a_le_bac: true, serie: "D", mention: "B" },
      ...overrides,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function monter(id = "1") {
  const router = createMemoryRouter(
    [{ path: "/personnes/etudiants/:id", element: <FicheEtudiant /> }],
    { initialEntries: [`/personnes/etudiants/${id}`] },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => apiFetchMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("FicheEtudiant", () => {
  it("rend identité, affiliations et BAC", async () => {
    apiFetchMock.mockResolvedValue(fiche());
    monter();
    expect(
      await screen.findByRole("heading", { name: /ESSIG-FCVGUDE1/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Gabonaise")).toBeInTheDocument(); // dd nationalité (identité)
    expect(screen.getByText("PERE")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Situation BAC/i }),
    ).toBeInTheDocument();
  });

  it("gère l'absence de BAC et 0 affiliation", async () => {
    apiFetchMock.mockResolvedValue(fiche({ affiliations: [], situation_bac: null }));
    monter();
    await screen.findByText("ESSIG-FCVGUDE1");
    expect(screen.getByText(/Aucune affiliation/i)).toBeInTheDocument();
    expect(screen.getByText(/Pas d.information BAC/i)).toBeInTheDocument();
  });
});
