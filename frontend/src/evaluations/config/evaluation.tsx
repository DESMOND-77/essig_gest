import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const evaluationDescripteur: Descripteur = {
  titre: "Évaluations",
  endpoint: "evaluations/evaluations",
  roleEcriture: ["SCOLARITE", "DIRECTION"],
  rechercheActive: false,
  colonnes: [
    { cle: "type", entete: "Type" },
    { cle: "ponderation", entete: "Pondération (%)" },
    { cle: "bareme", entete: "Barème" },
    { cle: "date", entete: "Date" },
  ],
  filtres: [
    { nom: "matiere", label: "Matière", fkEndpoint: "referentiel/matieres" },
    { nom: "classe", label: "Classe", fkEndpoint: "referentiel/classes" },
    { nom: "session_examen", label: "Session", fkEndpoint: "referentiel/sessions-examen" },
  ],
  champs: [
    {
      nom: "matiere",
      label: "Matière",
      type: "fk",
      requis: true,
      fkEndpoint: "referentiel/matieres",
      fkLabel: (o) => String(o.code),
    },
    {
      nom: "classe",
      label: "Classe",
      type: "fk",
      requis: true,
      fkEndpoint: "referentiel/classes",
      fkLabel: (o) => String(o.libelle_auto),
    },
    {
      nom: "session_examen",
      label: "Session d'examen",
      type: "fk",
      requis: true,
      fkEndpoint: "referentiel/sessions-examen",
      fkLabel: (o) => String(o.type),
    },
    {
      nom: "type",
      label: "Type",
      type: "select",
      requis: true,
      options: [
        { valeur: "CC", label: "Contrôle continu" },
        { valeur: "EXAMEN", label: "Examen" },
        { valeur: "TP", label: "Travaux pratiques" },
        { valeur: "PROJET", label: "Projet" },
      ],
    },
    { nom: "ponderation", label: "Pondération (%)", type: "number", requis: true },
    { nom: "bareme", label: "Barème", type: "number" },
  ],
  schema: z.object({
    matiere: z.number({ error: "Obligatoire" }),
    classe: z.number({ error: "Obligatoire" }),
    session_examen: z.number({ error: "Obligatoire" }),
    type: z.enum(["CC", "EXAMEN", "TP", "PROJET"]),
    ponderation: z.number({ error: "Obligatoire" }).min(0.01).max(100),
    bareme: z.number().int().min(1).optional(),
  }),
};
