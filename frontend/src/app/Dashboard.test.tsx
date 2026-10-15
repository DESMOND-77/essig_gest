import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));
import { apiFetch } from "../api/client";
import { Dashboard } from "./Dashboard";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

function reponse(corps: Record<string, unknown>) {
  return new Response(JSON.stringify(corps), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function monter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Dashboard />
    </QueryClientProvider>,
  );
}

beforeEach(() => apiFetchMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("Dashboard", () => {
  it("affiche les indicateurs calculés par le backend", async () => {
    apiFetchMock.mockResolvedValue(
      reponse({
        annee_scolaire_id: 1,
        annee_scolaire_libelle: "2026-2027",
        etudiants_inscrits: 42,
        encaissements: "1500000",
        reste_a_recouvrer: "300000",
        depenses: "200000",
        solde_comptes: "900000",
        masse_salariale: "600000",
        resultats_par_decision: { ADMIS: 10, REDOUBLE: 2 },
        alertes: { echeances_en_retard: 3, arretes_caisse_en_ecart: 0 },
      }),
    );
    monter();

    expect(await screen.findByText(/année scolaire courante : 2026-2027/i)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/1\s?500\s?000\s?FCFA/)).toBeInTheDocument();
    expect(screen.getByText(/ADMIS/)).toBeInTheDocument();
    expect(screen.getByText(/échéance\(s\) en retard/)).toBeInTheDocument();
  });

  it("affiche un message quand aucune année scolaire n'est courante", async () => {
    apiFetchMock.mockResolvedValue(
      reponse({
        annee_scolaire_id: null,
        annee_scolaire_libelle: null,
        etudiants_inscrits: 0,
        encaissements: "0",
        reste_a_recouvrer: "0",
        depenses: "0",
        solde_comptes: 0,
        masse_salariale: "0",
        resultats_par_decision: {},
        alertes: { echeances_en_retard: 0, arretes_caisse_en_ecart: 0 },
      }),
    );
    monter();

    expect(await screen.findByText(/aucune année scolaire courante/i)).toBeInTheDocument();
    expect(screen.getByText(/aucun résultat annuel délibéré/i)).toBeInTheDocument();
    expect(screen.getByText(/aucune alerte/i)).toBeInTheDocument();
  });
});
