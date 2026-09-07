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
  it("affiche Référentiel et Personnes comme liens actifs", () => {
    rendre();
    expect(screen.getByRole("link", { name: /référentiel/i })).toHaveAttribute(
      "href",
      "/referentiel/ecoles",
    );
    expect(screen.getByRole("link", { name: /personnes/i })).toHaveAttribute(
      "href",
      "/personnes/etudiants",
    );
  });

  it("désactive les 4 modules à venir", () => {
    rendre();
    for (const nom of [/scolarité/i, /trésorerie/i, /paie/i, /résultats/i]) {
      expect(screen.getByText(nom).closest("a")).toBeNull();
    }
  });
});
