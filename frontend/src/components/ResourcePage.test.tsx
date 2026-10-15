import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const useAuthMock = vi.fn();
vi.mock("../auth/AuthContext", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));

import { apiFetch } from "../api/client";
import { ResourcePage } from "./ResourcePage";
import { ToastProvider } from "./ToastProvider";
import type { Descripteur } from "../referentiel/descripteur";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

const descripteur: Descripteur = {
  titre: "Écoles",
  endpoint: "referentiel/ecoles",
  roleEcriture: ["DIRECTION"],
  colonnes: [
    { cle: "nom", entete: "Nom" },
    { cle: "code", entete: "Code" },
  ],
  champs: [{ nom: "nom", label: "Nom", type: "text", requis: true }],
  schema: z.object({ nom: z.string().min(1) }),
};

function pageRep() {
  return new Response(
    JSON.stringify({
      count: 2,
      next: null,
      previous: null,
      results: [
        { id: 1, nom: "Lycée A", code: "LA" },
        { id: 2, nom: "Collège B", code: "CB" },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  apiFetchMock.mockReset().mockResolvedValue(pageRep());
  useAuthMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("ResourcePage", () => {
  it("rend les lignes de la page et le compteur", async () => {
    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "LECTURE" }] } });
    render(<ResourcePage descripteur={descripteur} />, { wrapper });

    expect(await screen.findByText("Lycée A")).toBeInTheDocument();
    expect(screen.getByText("Collège B")).toBeInTheDocument();
    expect(screen.getByText("2 élément(s)")).toBeInTheDocument();
  });

  it("masque « Créer » sans rôle d'écriture", async () => {
    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "LECTURE" }] } });
    render(<ResourcePage descripteur={descripteur} />, { wrapper });

    await screen.findByText("Lycée A");
    expect(screen.queryByRole("button", { name: "Créer" })).toBeNull();
  });

  it("affiche « Créer » avec un rôle autorisé", async () => {
    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "DIRECTION" }] } });
    render(<ResourcePage descripteur={descripteur} />, { wrapper });

    await screen.findByText("Lycée A");
    expect(screen.getByRole("button", { name: "Créer" })).toBeInTheDocument();
  });

  it("ouvre le formulaire de création dans une fenêtre modale", async () => {
    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "DIRECTION" }] } });
    render(<ResourcePage descripteur={descripteur} />, { wrapper });

    await screen.findByText("Lycée A");
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Créer" }));

    const dialogue = await screen.findByRole("dialog");
    expect(dialogue).toBeInTheDocument();
    expect(screen.getByText("Créer — Écoles")).toBeInTheDocument();
    expect(screen.getByLabelText(/nom/i)).toBeInTheDocument();
  });
});
