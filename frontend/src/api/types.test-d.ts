import type { MoiReponse } from "./types";

// Test de contrat : `MoiReponse` est le type généré (`components["schemas"]["Moi"]`).
// L'affectation d'un littéral sans cast vérifie structurellement la forme —
// toute dérive du backend (champ retiré/renommé) casse ce fichier au typecheck.
const _exemple: MoiReponse = {
  id: 1,
  login: "x",
  email: "y",
  roles: [{ code: "COMPTABLE", ecole_id: null }],
};
void _exemple;

// roles doit accepter le tableau vide (utilisateur sans rôle)
const _sansRole: MoiReponse = { id: 2, login: "z", email: "z", roles: [] };
void _sansRole;
