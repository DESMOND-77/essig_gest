import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

describe("Card", () => {
  it("rend le titre et le contenu", () => {
    render(
      <Card data-testid="carte">
        <CardHeader>
          <CardTitle>Titre</CardTitle>
        </CardHeader>
        <CardContent>Contenu</CardContent>
      </Card>,
    );
    expect(screen.getByTestId("carte")).toBeInTheDocument();
    expect(screen.getByText("Titre")).toBeInTheDocument();
    expect(screen.getByText("Contenu")).toBeInTheDocument();
  });
});
