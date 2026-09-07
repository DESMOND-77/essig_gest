import { z } from "zod";
import type { Descripteur } from "../descripteur";

const CODES = [
  { valeur: "FI", label: "FI — Formation initiale" },
  { valeur: "FC", label: "FC — Formation continue" },
  { valeur: "FL", label: "FL" },
  { valeur: "FT", label: "FT" },
];

export const modaliteFormationDescripteur: Descripteur = {
  titre: "Modalités de formation",
  endpoint: "referentiel/modalites-formation",
  roleEcriture: ["DIRECTION"],
  rechercheActive: true,
  colonnes: [
    { cle: "code", entete: "Code" },
    { cle: "libelle", entete: "Libellé" },
  ],
  champs: [
    { nom: "code", label: "Code", type: "select", requis: true, options: CODES },
    { nom: "libelle", label: "Libellé", type: "text", requis: true },
  ],
  schema: z.object({
    code: z.enum(["FI", "FC", "FL", "FT"]),
    libelle: z.string().min(1, "Obligatoire").max(60),
  }),
};
