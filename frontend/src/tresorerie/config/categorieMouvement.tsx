import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const categorieMouvementDescripteur: Descripteur = {
  titre: "Catégories de mouvement",
  endpoint: "tresorerie/categories-mouvement",
  roleEcriture: ["COMPTABLE", "DAF"],
  colonnes: [
    { cle: "code", entete: "Code" },
    { cle: "libelle", entete: "Libellé" },
    { cle: "sens", entete: "Sens" },
  ],
  champs: [
    { nom: "code", label: "Code", type: "text", requis: true },
    { nom: "libelle", label: "Libellé", type: "text", requis: true },
    { nom: "sens", label: "Sens", type: "select", requis: true, options: [
      { valeur: "ENTREE", label: "Entrée" },
      { valeur: "SORTIE", label: "Sortie" },
      { valeur: "NEUTRE", label: "Neutre" },
    ] },
  ],
  schema: z.object({
    code: z.string().min(1, "Obligatoire").max(40),
    libelle: z.string().min(1, "Obligatoire").max(120),
    sens: z.enum(["ENTREE", "SORTIE", "NEUTRE"]),
  }),
};