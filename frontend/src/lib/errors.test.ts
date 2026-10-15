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
  it("401 -> message de session expirée", () => {
    expect(messageErreur(401, null)).toMatch(/session expirée/i);
  });
  it("429 -> message de limite de requêtes", () => {
    expect(messageErreur(429, null)).toMatch(/trop de requêtes/i);
  });
});
