import { z } from "zod";
import type { Descripteur } from "../descripteur";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const anneeScolaireDescripteur: Descripteur = {
  titre: "Années scolaires",
  endpoint: "referentiel/annees-scolaires",
  roleEcriture: ["DIRECTION"],
  rechercheActive: true,
  colonnes: [
    { cle: "libelle", entete: "Libellé" },
    { cle: "date_debut", entete: "Début" },
    { cle: "date_fin", entete: "Fin" },
    { cle: "est_courante", entete: "Courante", rendu: (l) => (l.est_courante ? "Oui" : "Non") },
  ],
  filtres: [
    {
      nom: "est_courante",
      label: "Courante",
      options: [
        { valeur: "true", label: "Oui" },
        { valeur: "false", label: "Non" },
      ],
    },
  ],
  champs: [
    { nom: "libelle", label: "Libellé", type: "text", requis: true, aide: "Format AAAA-AAAA" },
    { nom: "date_debut", label: "Date de début", type: "text", requis: true, aide: "AAAA-MM-JJ" },
    { nom: "date_fin", label: "Date de fin", type: "text", requis: true, aide: "AAAA-MM-JJ" },
    { nom: "est_courante", label: "Année courante", type: "checkbox" },
  ],
  schema: z.object({
    libelle: z.string().regex(/^\d{4}-\d{4}$/, "Format AAAA-AAAA"),
    date_debut: z.string().regex(DATE, "Format AAAA-MM-JJ"),
    date_fin: z.string().regex(DATE, "Format AAAA-MM-JJ"),
    est_courante: z.boolean().optional(),
  }),
};
