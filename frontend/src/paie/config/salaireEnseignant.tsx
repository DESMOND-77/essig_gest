import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

const MOIS = [
  { valeur: "SEPT", label: "Septembre" },
  { valeur: "OCT", label: "Octobre" },
  { valeur: "NOV", label: "Novembre" },
  { valeur: "DEC", label: "Décembre" },
  { valeur: "JAN", label: "Janvier" },
  { valeur: "FEV", label: "Février" },
  { valeur: "MAR", label: "Mars" },
  { valeur: "AVR", label: "Avril" },
  { valeur: "MAI", label: "Mai" },
  { valeur: "JUIN", label: "Juin" },
  { valeur: "JUIL", label: "Juillet" },
  { valeur: "AOUT", label: "Août" },
];

export const salaireEnseignantDescripteur: Descripteur = {
  titre: "Salaires enseignants",
  endpoint: "rh-paie/salaires-enseignant",
  roleEcriture: ["COMPTABLE", "DAF"],
  rechercheActive: false,
  colonnes: [
    { cle: "enseignant_nom", entete: "Enseignant" },
    { cle: "annee_scolaire_libelle", entete: "Année" },
    { cle: "mois", entete: "Mois" },
    { cle: "montant", entete: "Montant" },
    { cle: "statut", entete: "Statut" },
  ],
  filtres: [
    { nom: "enseignant", label: "Enseignant", fkEndpoint: "rh-paie/enseignants" },
    { nom: "annee_scolaire", label: "Année scolaire", fkEndpoint: "referentiel/annees-scolaires" },
    { nom: "mois", label: "Mois", options: MOIS },
    {
      nom: "statut",
      label: "Statut",
      options: [
        { valeur: "BROUILLON", label: "Brouillon" },
        { valeur: "VALIDÉ", label: "Validé" },
        { valeur: "PAYÉ", label: "Payé" },
      ],
    },
  ],
  champs: [
    {
      nom: "enseignant",
      label: "Enseignant",
      type: "fk",
      requis: true,
      fkEndpoint: "rh-paie/enseignants",
      fkLabel: (o) => `${String(o.nom)} ${String(o.prenom)}`,
    },
    {
      nom: "affectation_enseignement",
      label: "Affectation",
      type: "fk",
      fkEndpoint: "rh-paie/affectations-enseignement",
      fkLabel: (o) => String(o.matiere_nom ?? o.id),
    },
    {
      nom: "annee_scolaire",
      label: "Année scolaire",
      type: "fk",
      requis: true,
      fkEndpoint: "referentiel/annees-scolaires",
      fkLabel: (o) => String(o.libelle),
    },
    { nom: "mois", label: "Mois", type: "select", requis: true, options: MOIS },
    { nom: "date_paiement", label: "Date de paiement", type: "text", requis: true },
    { nom: "montant", label: "Montant (FCFA)", type: "number", requis: true },
    {
      nom: "compte",
      label: "Compte",
      type: "fk",
      requis: true,
      fkEndpoint: "tresorerie/comptes",
      fkLabel: (o) => `${String(o.code)} - ${String(o.libelle)}`,
    },
  ],
  schema: z.object({
    enseignant: z.number({ error: "Obligatoire" }),
    affectation_enseignement: z.number().optional(),
    annee_scolaire: z.number({ error: "Obligatoire" }),
    mois: z.enum(["SEPT", "OCT", "NOV", "DEC", "JAN", "FEV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOUT"]),
    date_paiement: z.string().min(1, "Obligatoire"),
    montant: z.number({ error: "Obligatoire" }).min(0),
    compte: z.number({ error: "Obligatoire" }),
  }),
};
