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
import { etudiantDescripteur } from "./etudiant";

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
          matricule: "ESSIG-FCVGUDE1",
          nom: "Gumapi clos",
          prenoms: "desmond junior",
          sexe: "F",
          nationalite: "Gabonaise",
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
  apiFetchMock.mockReset().mockResolvedValue(rep());
  useAuthMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("etudiantDescripteur", () => {
  it("rend la liste et le compteur", async () => {
    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "LECTURE" }] } });
    render(<ResourcePage descripteur={etudiantDescripteur} />, { wrapper });
    expect(await screen.findByText("ESSIG-FCVGUDE1")).toBeInTheDocument();
    expect(screen.getByText("1 élément(s)")).toBeInTheDocument();
  });

  it("affiche « Créer » pour SCOLARITE", async () => {
    useAuthMock.mockReturnValue({ utilisateur: { roles: [{ code: "SCOLARITE" }] } });
    render(<ResourcePage descripteur={etudiantDescripteur} />, { wrapper });
    await screen.findByText("ESSIG-FCVGUDE1");
    expect(screen.getByRole("button", { name: "Créer" })).toBeInTheDocument();
  });
});
