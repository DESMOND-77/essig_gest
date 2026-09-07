import { z } from "zod";
import type { Descripteur } from "../descripteur";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const periodeDescripteur: Descripteur = {
  titre: "Périodes",
  endpoint: "referentiel/periodes",
  roleEcriture: ["DIRECTION", "SCOLARITE"],
  rechercheActive: true,
  colonnes: [
    { cle: "numero", entete: "N°" },
    { cle: "libelle", entete: "Libellé" },
    { cle: "date_debut", entete: "Début" },
    { cle: "date_fin", entete: "Fin" },
    { cle: "annee_scolaire_libelle", entete: "Année" },
  ],
  filtres: [{ nom: "annee_scolaire", label: "Année", fkEndpoint: "referentiel/annees-scolaires" }],
  champs: [
    { nom: "annee_scolaire", label: "Année scolaire", type: "fk", requis: true, fkEndpoint: "referentiel/annees-scolaires", fkLabel: (o) => String(o.libelle) },
    { nom: "numero", label: "Numéro (1 ou 2)", type: "number", requis: true },
    { nom: "libelle", label: "Libellé", type: "text", requis: true },
    { nom: "date_debut", label: "Date de début", type: "text", requis: true, aide: "AAAA-MM-JJ" },
    { nom: "date_fin", label: "Date de fin", type: "text", requis: true, aide: "AAAA-MM-JJ" },
  ],
  schema: z.object({
    annee_scolaire: z.number({ error: "Obligatoire" }),
    numero: z.number({ error: "Obligatoire" }).int().min(1, "1 ou 2").max(2, "1 ou 2"),
    libelle: z.string().min(1, "Obligatoire").max(40),
    date_debut: z.string().regex(DATE, "Format AAAA-MM-JJ"),
    date_fin: z.string().regex(DATE, "Format AAAA-MM-JJ"),
  }),
};
