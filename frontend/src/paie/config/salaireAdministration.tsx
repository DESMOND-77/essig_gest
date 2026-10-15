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

export const salaireAdministrationDescripteur: Descripteur = {
  titre: "Salaires administration",
  endpoint: "rh-paie/salaires-administration",
  roleEcriture: ["COMPTABLE", "DAF"],
  rechercheActive: false,
  colonnes: [
    { cle: "personnel_administratif_nom", entete: "Personnel" },
    { cle: "annee_scolaire_libelle", entete: "Année" },
    { cle: "mois", entete: "Mois" },
    { cle: "montant_du", entete: "Montant dû" },
    { cle: "montant_paye", entete: "Montant payé" },
    { cle: "statut", entete: "Statut" },
  ],
  filtres: [
    { nom: "personnel_administratif", label: "Personnel", fkEndpoint: "rh-paie/personnel-administratif" },
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
      nom: "personnel_administratif",
      label: "Personnel administratif",
      type: "fk",
      requis: true,
      fkEndpoint: "rh-paie/personnel-administratif",
      fkLabel: (o) => `${String(o.nom)} ${String(o.prenom)}`,
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
    { nom: "montant_du", label: "Montant dû (FCFA)", type: "number", requis: true },
    { nom: "montant_paye", label: "Montant payé (FCFA)", type: "number", requis: true },
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
    personnel_administratif: z.number({ error: "Obligatoire" }),
    annee_scolaire: z.number({ error: "Obligatoire" }),
    mois: z.enum(["SEPT", "OCT", "NOV", "DEC", "JAN", "FEV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOUT"]),
    date_paiement: z.string().min(1, "Obligatoire"),
    montant_du: z.number({ error: "Obligatoire" }).min(0),
    montant_paye: z.number({ error: "Obligatoire" }).min(0),
    compte: z.number({ error: "Obligatoire" }),
  }),
};
