import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Interception ESM fiable : cf. lib/resource.test.tsx.
vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));

import { apiFetch } from "../api/client";
import { ResourceForm } from "./ResourceForm";
import { ToastProvider } from "./ToastProvider";
import type { Descripteur } from "../referentiel/descripteur";

const apiFetchMock = apiFetch as unknown as ReturnType<typeof vi.fn>;

function rep(corps: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(corps), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const descripteur: Descripteur = {
  titre: "École",
  endpoint: "referentiel/ecoles",
  roleEcriture: ["DIRECTION"],
  colonnes: [{ cle: "nom", entete: "Nom" }],
  champs: [
    { nom: "nom", label: "Nom", type: "text", requis: true },
    { nom: "code", label: "Code", type: "text", requis: true },
  ],
  schema: z.object({
    nom: z.string().min(1, "Nom requis"),
    code: z.string().min(1, "Code requis"),
  }),
};

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
};

beforeEach(() => apiFetchMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("ResourceForm", () => {
  it("POST la ressource puis ferme le formulaire au succès", async () => {
    apiFetchMock.mockResolvedValue(rep({ id: 7, nom: "Lycée A", code: "LA" }, 201));
    const onFerme = vi.fn();
    render(<ResourceForm descripteur={descripteur} onFerme={onFerme} />, { wrapper });

    await userEvent.type(screen.getByLabelText(/Nom/), "Lycée A");
    await userEvent.type(screen.getByLabelText(/Code/), "LA");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onFerme).toHaveBeenCalled());
    const [url, init] = apiFetchMock.mock.calls[0];
    expect(url).toBe("/referentiel/ecoles/");
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse((init as { body: string }).body)).toEqual({
      nom: "Lycée A",
      code: "LA",
    });
  });

  it("mappe une erreur de champ DRF (400) sur le champ concerné", async () => {
    apiFetchMock.mockResolvedValue(rep({ code: ["Ce code existe déjà."] }, 400));
    render(<ResourceForm descripteur={descripteur} onFerme={vi.fn()} />, { wrapper });

    await userEvent.type(screen.getByLabelText(/Nom/), "X");
    await userEvent.type(screen.getByLabelText(/Code/), "LA");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Ce code existe déjà.")).toBeInTheDocument();
  });

  it("bloque l'appel API si la validation Zod échoue", async () => {
    render(<ResourceForm descripteur={descripteur} onFerme={vi.fn()} />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Nom requis")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("masque un champ creationSeule en édition et l'affiche en création", () => {
    const d: Descripteur = {
      titre: "T",
      endpoint: "x/y",
      roleEcriture: ["DIRECTION"],
      colonnes: [],
      champs: [
        { nom: "nom", label: "Nom", type: "text", requis: true },
        {
          nom: "pole",
          label: "Pôle",
          type: "select",
          creationSeule: true,
          options: [{ valeur: "ESSIG", label: "ESSIG" }],
        },
      ],
      schema: z.object({ nom: z.string().min(1), pole: z.string().optional() }),
    };
    const { unmount } = render(
      <ResourceForm descripteur={d} onFerme={() => {}} />,
      { wrapper },
    );
    expect(screen.getByLabelText("Pôle")).toBeInTheDocument();
    unmount();

    render(
      <ResourceForm descripteur={d} valeurs={{ id: 1, nom: "A" }} onFerme={() => {}} />,
      { wrapper },
    );
    expect(screen.queryByLabelText("Pôle")).toBeNull();
  });
});
