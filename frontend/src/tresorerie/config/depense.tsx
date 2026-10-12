import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const depenseDescripteur = {
  titre: "Dépenses",
  endpoint: "depenses",
  roleEcriture: ["COMPTABLE", "DAF"],
  colonnes: [
    { cle: "date", entete: "Date" },
    { cle: "beneficiaire", entete: "Bénéficiaire" },
    { cle: "designation", entete: "Désignation", rendu: (ligne) => ligne.designation?.length ? ligne.designation.substring(0, 50) + (ligne.designation?.length > 50 ? "..." : "") : "" },
    { cle: "montant", entete: "Montant (FCFA)" },
    { cle: "categorie_mouvement_libelle", entete: "Catégorie", rendu: (ligne) => ligne.categorie_mouvement_libelle || "" },
    { cle: "compte_libelle", entete: "Compte", rendu: (ligne) => ligne.compte_libelle || "" },
    { cle: "ecole_libelle", entete: "École", rendu: (ligne) => ligne.ecole_libelle || "" },
    { cle: "annee_scolaire_libelle", entete: "Année scolaire", rendu: (ligne) => ligne.annee_scolaire_libelle || "" },
    { cle: "statut", entete: "Statut" },
  ],
  champs: [
    { nom: "date", label: "Date", type: "date", requis: true, aide: "AAAA-MM-JJ" },
    { nom: "categorie_mouvement", label: "Catégorie de mouvement", type: "fk", requis: true, fkEndpoint: "categories-mouvement?sens=SORTIE", fkLabel: (o) => `${o.code} - ${o.libelle}` },
    { nom: "beneficiaire", label: "Bénéficiaire", type: "text", requis: true },
    { nom: "designation", label: "Désignation", type: "text", requis: true },
    { nom: "montant", label: "Montant (FCFA)", type: "number", requis: true, min: 1 },
    { nom: "compte", label: "Compte de débit", type: "fk", requis: true, fkEndpoint: "comptes", fkLabel: (o) => `${o.code} - ${o.libelle}` },
    { nom: "ecole", label: "École", type: "fk", fkEndpoint: "referentiel/ecoles", fkLabel: (o) => o.nom },
    { nom: "annee_scolaire", label: "Année scolaire", type: "fk", requis: true, fkEndpoint: "referentiel/annees-scolaires", fkLabel: (o) => o.libelle },
    { nom: "piece_justificative", label: "Pièce justificative", type: "text" },
  ],
  schema: z.object({
    date: z.date({ error: "Date invalide" }),
    categorie_mouvement: z.number({ error: "Obligatoire" }),
    beneficiaire: z.string().min(1, "Obligatoire").max(150),
    designation: z.string().min(1, "Obligatoire").max(255),
    montant: z.number().int().positive({ error: "Le montant doit être un entier positif" }),
    compte: z.number({ error: "Obligatoire" }),
    ecole: z.number().optional(),
    annee_scolaire: z.number({ error: "Obligatoire" }),
    piece_justificative: z.string().max(255).optional().or(z.literal("")),
  }),
};