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
import { inscriptionDescripteur } from "./inscription";

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
          numero_ordre: 1,
          etudiant_libelle: "ESSIG-FCVGUDE1 — Gumapi clos desmond junior",
          classe_libelle: "L1 INFO",
          type: "INSCRIPTION",
          etat: "ACTIVE",
          est_boursier: false,
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

describe("inscriptionDescripteur", () => {
  it("rend la liste et le compteur", async () => {
    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "LECTURE" }] } });
    render(<ResourcePage descripteur={inscriptionDescripteur} />, { wrapper });
    expect(
      await screen.findByText("ESSIG-FCVGUDE1 — Gumapi clos desmond junior"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 élément(s)")).toBeInTheDocument();
  });

  it("affiche « Créer » pour SCOLARITE, pas pour LECTURE", async () => {
    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "SCOLARITE" }] } });
    const { unmount } = render(
      <ResourcePage descripteur={inscriptionDescripteur} />,
      { wrapper },
    );
    await screen.findByText(/Gumapi clos/);
    expect(screen.getByRole("button", { name: "Créer" })).toBeInTheDocument();
    unmount();

    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "LECTURE" }] } });
    render(<ResourcePage descripteur={inscriptionDescripteur} />, { wrapper });
    await screen.findByText(/Gumapi clos/);
    expect(screen.queryByRole("button", { name: "Créer" })).toBeNull();
  });
});
