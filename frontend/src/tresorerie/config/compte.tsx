import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const compteDescripteur: Descripteur = {
  titre: "Comptes",
  endpoint: "comptes",
  roleEcriture: ["COMPTABLE", "DAF"],
  colonnes: [
    { cle: "code", entete: "Code" },
    { cle: "libelle", entete: "Libellé" },
    { cle: "type", entete: "Type" },
    { cle: "banque", entete: "Banque", rendu: (ligne) => (ligne.banque ?? "") },
    { cle: "solde_actuel", entete: "Solde courant (FCFA)", rendu: (ligne) => ligne.solde_actuel?.toString() || "0" },
    { cle: "actif", entete: "Actif", rendu: (ligne) => (ligne.actif ? "Oui" : "Non") },
  ],
  champs: [
    { nom: "groupe_scolaire", label: "Groupe scolaire", type: "fk", requis: true, fkEndpoint: "referentiel/groupes-scolaires", fkLabel: (o) => String(o.nom) },
    { nom: "code", label: "Code", type: "text", requis: true },
    { nom: "libelle", label: "Libellé", type: "text", requis: true },
    { nom: "type", label: "Type", type: "select", requis: true, options: [
      { valeur: "CAISSE", label: "Caisse" },
      { valeur: "BANQUE", label: "Banque" },
      { valeur: "MOBILE_MONEY", label: "Mobile Money" },
      { valeur: "VIRTUEL", label: "Virtuel" },
    ] },
    { nom: "numero_bancaire", label: "Numéro bancaire", type: "text" },
    { nom: "banque", label: "Banque", type: "text" },
    { nom: "actif", label: "Actif", type: "checkbox", requis: true },
  ],
  schema: z.object({
    groupe_scolaire: z.number({ error: "Obligatoire" }),
    code: z.string().min(1, "Obligatoire").max(30),
    libelle: z.string().min(1, "Obligatoire").max(120),
    type: z.enum(["CAISSE", "BANQUE", "MOBILE_MONEY", "VIRTUEL"]),
    numero_bancaire: z.string().max(40).optional().or(z.literal("")),
    banque: z.string().max(120).optional().or(z.literal("")),
    actif: z.boolean().default(true),
  }),
};