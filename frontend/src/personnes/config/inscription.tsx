import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

const TYPES = [
  { valeur: "INSCRIPTION", label: "Inscription" },
  { valeur: "REINSCRIPTION", label: "Réinscription" },
];
const STATUTS = [
  { valeur: "NOUVEAU", label: "Nouveau" },
  { valeur: "ANCIEN", label: "Ancien" },
];
const ETATS = ["ACTIVE", "ABANDON", "EXCLU", "DIPLOME"].map((v) => ({ valeur: v, label: v }));

export const inscriptionDescripteur: Descripteur = {
  titre: "Inscriptions",
  endpoint: "personnes/inscriptions",
  roleEcriture: ["DIRECTION", "SCOLARITE"],
  rechercheActive: true,
  colonnes: [
    { cle: "numero_ordre", entete: "N°" },
    { cle: "etudiant_libelle", entete: "Étudiant" },
    { cle: "classe_libelle", entete: "Classe" },
    { cle: "type", entete: "Type" },
    { cle: "etat", entete: "État" },
    { cle: "est_boursier", entete: "Boursier", rendu: (l) => (l.est_boursier ? "Oui" : "Non") },
  ],
  filtres: [
    { nom: "annee_scolaire", label: "Année", fkEndpoint: "referentiel/annees-scolaires" },
    { nom: "ecole", label: "École", fkEndpoint: "referentiel/ecoles" },
    { nom: "classe", label: "Classe", fkEndpoint: "referentiel/classes" },
    { nom: "type", label: "Type", options: TYPES },
    { nom: "etat", label: "État", options: ETATS },
  ],
  champs: [
    { nom: "etudiant", label: "Étudiant", type: "fk", requis: true, fkEndpoint: "personnes/etudiants", fkLabel: (o) => `${o.matricule} — ${o.nom} ${o.prenoms}` },
    { nom: "classe", label: "Classe", type: "fk", requis: true, creationSeule: true, fkEndpoint: "referentiel/classes", fkLabel: (o) => String(o.libelle_auto) },
    { nom: "date_inscription", label: "Date d'inscription", type: "text", requis: true, aide: "AAAA-MM-JJ" },
    { nom: "est_boursier", label: "Boursier", type: "checkbox" },
    { nom: "cout_scolarite_negocie", label: "Coût négocié (FCFA)", type: "number", aide: "vide = grille" },
    { nom: "etablissement_provenance", label: "Établissement de provenance", type: "text" },
    { nom: "type", label: "Type", type: "select", options: TYPES, aide: "vide = déduit du dossier" },
    { nom: "statut", label: "Statut", type: "select", options: STATUTS, aide: "vide = déduit du dossier" },
  ],
  schema: z.object({
    etudiant: z.number({ error: "Obligatoire" }),
    classe: z.number({ error: "Obligatoire" }),
    date_inscription: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format AAAA-MM-JJ"),
    est_boursier: z.boolean().optional(),
    cout_scolarite_negocie: z.union([z.number().int().nonnegative(), z.nan()]).optional(),
    etablissement_provenance: z.string().max(150).optional().or(z.literal("")),
    type: z.enum(["INSCRIPTION", "REINSCRIPTION"]).optional().or(z.literal("")),
    statut: z.enum(["NOUVEAU", "ANCIEN"]).optional().or(z.literal("")),
  }),
};
