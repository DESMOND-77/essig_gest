import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));
import { apiFetch } from "../api/client";
import { FicheInscription } from "./FicheInscription";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

function fiche(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      id: 1,
      numero_ordre: 1,
      type: "INSCRIPTION",
      statut: "NOUVEAU",
      etat: "ACTIVE",
      est_boursier: false,
      date_inscription: "2025-10-01",
      etudiant_libelle: "ESSIG-FCVGUDE1 — Gumapi clos desmond junior",
      classe_libelle: "L1 INFO",
      echeances: [
        { id: 1, numero: 0, montant_prevu: "105000", date_prevue: "2025-10-01", pris_en_charge_bourse: false },
        { id: 2, numero: 1, montant_prevu: "70000", date_prevue: "2025-11-01", pris_en_charge_bourse: false },
      ],
      pieces_dossier: [{ id: 1, type_piece: 1, fournie: true, date_reception: "2025-10-02" }],
      ...overrides,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function monter(id = "1") {
  const router = createMemoryRouter(
    [{ path: "/personnes/inscriptions/:id", element: <FicheInscription /> }],
    { initialEntries: [`/personnes/inscriptions/${id}`] },
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

describe("FicheInscription", () => {
  it("rend en-tête, échéancier et pièces", async () => {
    apiFetchMock.mockResolvedValue(fiche());
    monter();
    expect(
      await screen.findByRole("heading", { name: /Inscription n°\s*1/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Échéancier/i })).toBeInTheDocument();
    expect(screen.getByText("105000")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Pièces du dossier/i }),
    ).toBeInTheDocument();
  });

  it("gère 0 échéance / 0 pièce", async () => {
    apiFetchMock.mockResolvedValue(fiche({ echeances: [], pieces_dossier: [] }));
    monter();
    await screen.findByRole("heading", { name: /Inscription n°\s*1/i });
    expect(screen.getByText(/Aucune échéance/i)).toBeInTheDocument();
    expect(screen.getByText(/Aucune pièce/i)).toBeInTheDocument();
  });
});
