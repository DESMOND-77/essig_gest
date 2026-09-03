import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./Sidebar";

const rendre = () =>
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );

describe("Sidebar", () => {
  it("affiche Référentiel comme lien actif", () => {
    rendre();
    const lien = screen.getByRole("link", { name: /référentiel/i });
    expect(lien).toHaveAttribute("href", "/referentiel/ecoles");
  });

  it("désactive les 5 modules à venir", () => {
    rendre();
    for (const nom of [/personnes/i, /scolarité/i, /trésorerie/i, /paie/i, /résultats/i]) {
      expect(screen.getByText(nom).closest("a")).toBeNull();
    }
  });
});
