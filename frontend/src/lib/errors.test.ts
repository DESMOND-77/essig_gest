import { describe, expect, it } from "vitest";
import { champErreurs, messageErreur } from "./errors";

describe("champErreurs", () => {
  it("mappe les listes DRF sur le premier message", () => {
    expect(champErreurs({ nom: ["Ce champ est obligatoire."], detail: "x" })).toEqual({
      nom: "Ce champ est obligatoire.",
    });
  });
});

describe("messageErreur", () => {
  it("403 -> message de rôle", () => {
    expect(messageErreur(403, null)).toMatch(/rôle/i);
  });
  it("409 -> message de suppression", () => {
    expect(messageErreur(409, null)).toMatch(/référencé/i);
  });
});
