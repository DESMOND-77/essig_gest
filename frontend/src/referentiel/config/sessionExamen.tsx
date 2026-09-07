import { z } from "zod";
import type { Descripteur } from "../descripteur";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const sessionExamenDescripteur: Descripteur = {
  titre: "Sessions d'examen",
  endpoint: "referentiel/sessions-examen",
  roleEcriture: ["DIRECTION", "SCOLARITE"],
  rechercheActive: true,
  colonnes: [
    { cle: "type", entete: "Type" },
    { cle: "date_debut", entete: "Début" },
    { cle: "date_fin", entete: "Fin" },
    { cle: "periode_libelle", entete: "Période" },
  ],
  filtres: [
    { nom: "periode", label: "Période", fkEndpoint: "referentiel/periodes" },
    {
      nom: "type",
      label: "Type",
      options: [
        { valeur: "NORMALE", label: "Normale" },
        { valeur: "RATTRAPAGE", label: "Rattrapage" },
      ],
    },
  ],
  champs: [
    { nom: "periode", label: "Période", type: "fk", requis: true, fkEndpoint: "referentiel/periodes", fkLabel: (o) => String(o.libelle) },
    {
      nom: "type",
      label: "Type",
      type: "select",
      requis: true,
      options: [
        { valeur: "NORMALE", label: "Normale" },
        { valeur: "RATTRAPAGE", label: "Rattrapage" },
      ],
    },
    { nom: "date_debut", label: "Date de début", type: "text", aide: "AAAA-MM-JJ" },
    { nom: "date_fin", label: "Date de fin", type: "text", aide: "AAAA-MM-JJ" },
  ],
  schema: z.object({
    periode: z.number({ error: "Obligatoire" }),
    type: z.enum(["NORMALE", "RATTRAPAGE"]),
    date_debut: z.string().regex(DATE, "Format AAAA-MM-JJ").optional().or(z.literal("")),
    date_fin: z.string().regex(DATE, "Format AAAA-MM-JJ").optional().or(z.literal("")),
  }),
};
