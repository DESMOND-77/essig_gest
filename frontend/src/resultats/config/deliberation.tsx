import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const deliberationDescripteur: Descripteur = {
  titre: "Délibérations",
  endpoint: "resultats/deliberations",
  roleEcriture: ["DIRECTION"],
  rechercheActive: false,
  colonnes: [
    { cle: "date", entete: "Date" },
    { cle: "president_jury", entete: "Président du jury" },
    { cle: "statut", entete: "Statut" },
  ],
  filtres: [
    { nom: "classe", label: "Classe", fkEndpoint: "referentiel/classes" },
    { nom: "statut", label: "Statut", options: [
      { valeur: "BROUILLON", label: "Brouillon" },
      { valeur: "VALIDEE", label: "Validée" },
    ] },
  ],
  champs: [
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
      nom: "periode",
      label: "Période (vide = délibération annuelle)",
      type: "fk",
      fkEndpoint: "referentiel/periodes",
      fkLabel: (o) => String(o.libelle),
    },
    { nom: "date", label: "Date", type: "text" },
    { nom: "president_jury", label: "Président du jury", type: "text", requis: true },
  ],
  schema: z.object({
    classe: z.number({ error: "Obligatoire" }),
    session_examen: z.number({ error: "Obligatoire" }),
    periode: z.number().optional(),
    date: z.string().min(1, "Obligatoire"),
    president_jury: z.string().min(1, "Obligatoire").max(150),
  }),
};
