import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const noteEvaluationDescripteur: Descripteur = {
  titre: "Notes",
  endpoint: "evaluations/notes",
  roleEcriture: ["SCOLARITE", "DIRECTION"],
  rechercheActive: false,
  colonnes: [
    { cle: "valeur", entete: "Valeur" },
    { cle: "absent", entete: "Absent" },
  ],
  filtres: [
    { nom: "evaluation", label: "Évaluation", fkEndpoint: "evaluations/evaluations" },
    { nom: "inscription", label: "Inscription", fkEndpoint: "personnes/inscriptions" },
  ],
  champs: [
    {
      nom: "evaluation",
      label: "Évaluation",
      type: "fk",
      requis: true,
      fkEndpoint: "evaluations/evaluations",
      fkLabel: (o) => `${o.type} (#${o.id})`,
    },
    {
      nom: "inscription",
      label: "Inscription",
      type: "fk",
      requis: true,
      fkEndpoint: "personnes/inscriptions",
      fkLabel: (o) => `#${o.id}`,
    },
    { nom: "valeur", label: "Valeur", type: "number" },
    { nom: "absent", label: "Absent", type: "checkbox" },
  ],
  schema: z.object({
    evaluation: z.number({ error: "Obligatoire" }),
    inscription: z.number({ error: "Obligatoire" }),
    valeur: z.number().min(0).optional(),
    absent: z.boolean().optional(),
  }),
};
