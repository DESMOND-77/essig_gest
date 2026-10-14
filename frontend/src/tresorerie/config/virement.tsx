import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const virementDescripteur: Descripteur = {
  titre: "Virements",
  endpoint: "tresorerie/virements",
  roleEcriture: ["COMPTABLE", "DAF"],
  colonnes: [
    { cle: "date", entete: "Date" },
    { cle: "compte_source_code", entete: "Compte source", rendu: (ligne) => ligne.compte_source_code || "" },
    { cle: "compte_destination_code", entete: "Compte destination", rendu: (ligne) => ligne.compte_destination_code || "" },
    { cle: "montant", entete: "Montant (FCFA)" },
    { cle: "statut", entete: "Statut" },
  ],
  champs: [
    { nom: "compte_source", label: "Compte source", type: "fk", requis: true, fkEndpoint: "tresorerie/comptes", fkLabel: (o) => `${o.code} - ${o.libelle}` },
    { nom: "compte_destination", label: "Compte destination", type: "fk", requis: true, fkEndpoint: "tresorerie/comptes", fkLabel: (o) => `${o.code} - ${o.libelle}` },
    { nom: "montant", label: "Montant (FCFA)", type: "number", requis: true, min: 1 },
    { nom: "date", label: "Date", type: "date", requis: true },
    { nom: "motif", label: "Motif", type: "text", requis: true },
  ],
  schema: z.object({
    compte_source: z.number({ error: "Obligatoire" }),
    compte_destination: z.number({ error: "Obligatoire" }),
    montant: z.number().int().positive(),
    date: z.date({ error: "Date invalide" }),
    motif: z.string().min(1, "Obligatoire").max(255),
  })
  .refine((data) => data.compte_source !== data.compte_destination, {
    message: "Le compte source et le compte destination doivent être différents",
    path: ["compte_destination"],
  }),
};