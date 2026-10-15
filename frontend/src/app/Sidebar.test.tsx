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
  it("affiche Référentiel, Personnes, Scolarité et Trésorerie comme liens actifs", () => {
    rendre();
    expect(screen.getByRole("link", { name: /référentiel/i })).toHaveAttribute(
      "href",
      "/referentiel/ecoles",
    );
    expect(screen.getByRole("link", { name: /personnes/i })).toHaveAttribute(
      "href",
      "/personnes/etudiants",
    );
    expect(screen.getByRole("link", { name: /scolarité/i })).toHaveAttribute(
      "href",
      "/scolarite/modalites-paiement",
    );
    expect(screen.getByRole("link", { name: /trésorerie/i })).toHaveAttribute(
      "href",
      "/tresorerie",
    );
    expect(screen.getByRole("link", { name: /évaluations/i })).toHaveAttribute(
      "href",
      "/evaluations/evaluations",
    );
    expect(screen.getByRole("link", { name: /résultats/i })).toHaveAttribute(
      "href",
      "/resultats/resultats-annuels",
    );
  });

  it("désactive les modules à venir (Paie)", () => {
    rendre();
    for (const nom of [/paie/i]) {
      expect(screen.getByText(nom).closest("a")).toBeNull();
    }
  });
});
