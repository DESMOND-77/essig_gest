import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    utilisateur: { id: 1, login: "dupont", email: "d@ex.ga", roles: [] },
    chargement: false,
    deconnexion: vi.fn(),
  }),
}));

describe("AppShell", () => {
  it("rend le contenu enfant derrière la sidebar", () => {
    const r = createMemoryRouter(
      [{ path: "/", element: <AppShell />, children: [{ index: true, element: <p>CONTENU</p> }] }],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={r} />);
    expect(screen.getByText("CONTENU")).toBeInTheDocument();
    expect(screen.getByText("dupont")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /référentiel/i })).toBeInTheDocument();
  });
});
