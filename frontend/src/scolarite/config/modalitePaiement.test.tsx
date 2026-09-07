import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../../api/client", () => ({ apiFetch: vi.fn() }));

import { apiFetch } from "../../api/client";
import { ResourcePage } from "../../components/ResourcePage";
import { ToastProvider } from "../../components/ToastProvider";
import { modalitePaiementDescripteur } from "./modalitePaiement";

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

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  apiFetchMock.mockReset().mockImplementation(() => Promise.resolve(rep()));
  useAuthMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("modalitePaiementDescripteur", () => {
  it("rend la liste avec le total", async () => {
    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "LECTURE" }] } });
    render(<ResourcePage descripteur={modalitePaiementDescripteur} />, { wrapper });
    expect(await screen.findByText("735000")).toBeInTheDocument();
  });

  it("« Créer » visible pour DIRECTION, pas pour SCOLARITE", async () => {
    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "DIRECTION" }] } });
    const { unmount } = render(
      <ResourcePage descripteur={modalitePaiementDescripteur} />,
      { wrapper },
    );
    await screen.findByText("735000");
    expect(screen.getByRole("button", { name: "Créer" })).toBeInTheDocument();
    unmount();

    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "SCOLARITE" }] } });
    render(<ResourcePage descripteur={modalitePaiementDescripteur} />, { wrapper });
    await screen.findByText("735000");
    expect(screen.queryByRole("button", { name: "Créer" })).toBeNull();
  });
});
