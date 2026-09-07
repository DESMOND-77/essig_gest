import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const modalitePaiementDescripteur: Descripteur = {
  titre: "Grilles tarifaires",
  endpoint: "scolarite/modalites-paiement",
  roleEcriture: ["DIRECTION"],
  rechercheActive: false,
  colonnes: [
    { cle: "niveau", entete: "Niveau" },
    { cle: "annee_scolaire", entete: "Année" },
    { cle: "montant_inscription_reinscription", entete: "Inscription" },
    { cle: "nombre_echeance", entete: "Nb échéances" },
    { cle: "montant_echeance", entete: "Montant échéance" },
    { cle: "montant_total", entete: "Total" },
  ],
  filtres: [
    { nom: "niveau", label: "Niveau", fkEndpoint: "referentiel/niveaux" },
    { nom: "annee_scolaire", label: "Année", fkEndpoint: "referentiel/annees-scolaires" },
  ],
  champs: [
    { nom: "niveau", label: "Niveau", type: "fk", requis: true, fkEndpoint: "referentiel/niveaux", fkLabel: (o) => String(o.code) },
    { nom: "annee_scolaire", label: "Année scolaire", type: "fk", requis: true, fkEndpoint: "referentiel/annees-scolaires", fkLabel: (o) => String(o.libelle) },
    { nom: "montant_inscription_reinscription", label: "Montant inscription/réinscription (FCFA)", type: "number", requis: true },
    { nom: "nombre_echeance", label: "Nombre d'échéances", type: "number", requis: true },
    { nom: "montant_echeance", label: "Montant par échéance (FCFA)", type: "number", requis: true },
  ],
  schema: z.object({
    niveau: z.number({ error: "Obligatoire" }),
    annee_scolaire: z.number({ error: "Obligatoire" }),
    montant_inscription_reinscription: z.number({ error: "Obligatoire" }).int().nonnegative(),
    nombre_echeance: z.number({ error: "Obligatoire" }).int().min(1, "Au moins 1"),
    montant_echeance: z.number({ error: "Obligatoire" }).int().nonnegative(),
  }),
};
