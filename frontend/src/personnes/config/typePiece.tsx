import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const typePieceDescripteur: Descripteur = {
  titre: "Types de pièce",
  endpoint: "personnes/types-piece",
  roleEcriture: ["DIRECTION", "SCOLARITE"],
  rechercheActive: true,
  colonnes: [
    { cle: "code", entete: "Code" },
    { cle: "libelle", entete: "Libellé" },
  ],
  champs: [
    { nom: "code", label: "Code", type: "text", requis: true },
    { nom: "libelle", label: "Libellé", type: "text", requis: true },
  ],
  schema: z.object({
    code: z.string().min(1, "Obligatoire").max(30),
    libelle: z.string().min(1, "Obligatoire").max(120),
  }),
};
