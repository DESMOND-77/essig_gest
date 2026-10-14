import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const encaissementDescripteur: Descripteur = {
  titre: "Encaissements",
  endpoint: "tresorerie/encaissements",
  roleEcriture: ["COMPTABLE", "DAF"],
  colonnes: [
    { cle: "recu_numero", entete: "Numéro de reçu" },
    { cle: "date", entete: "Date" },
    { cle: "inscription_libelle", entete: "Inscription", rendu: (ligne) => ligne.inscription_libelle || "" },
    { cle: "montant_total", entete: "Montant total (FCFA)" },
    { cle: "mode", entete: "Mode" },
    { cle: "compte_libelle", entete: "Compte", rendu: (ligne) => ligne.compte_libelle || "" },
    { cle: "statut", entete: "Statut" },
  ],
  champs: [
    { nom: "inscription", label: "Inscription", type: "fk", requis: true, fkEndpoint: "personnes/inscriptions", fkLabel: (o) => `N°${o.numero_ordre}` },
    { nom: "date", label: "Date", type: "date", requis: true },
    { nom: "montant_total", label: "Montant total (FCFA)", type: "number", requis: true, min: 1 },
    { nom: "mode", label: "Mode de paiement", type: "select", requis: true, options: [
      { valeur: "ESPECES", label: "Espèces" },
      { valeur: "VIREMENT", label: "Virement" },
      { valeur: "MOBILE_MONEY", label: "Mobile Money" },
      { valeur: "CHEQUE", label: "Chèque" },
    ] },
    { nom: "compte", label: "Compte de crédit", type: "fk", requis: true, fkEndpoint: "tresorerie/comptes", fkLabel: (o) => `${o.code} - ${o.libelle}` },
    { nom: "reference", label: "Référence de paiement", type: "text" },
  ],
  schema: z.object({
    inscription: z.number({ error: "Obligatoire" }),
    date: z.date({ error: "Date invalide" }),
    montant_total: z.number().int().positive({ error: "Le montant doit être un entier positif" }),
    mode: z.enum(["ESPECES", "VIREMENT", "MOBILE_MONEY", "CHEQUE"], { error: "Mode de paiement obligatoire" }),
    compte: z.number({ error: "Obligatoire" }),
    reference: z.string().max(255).optional(),
  }),
};