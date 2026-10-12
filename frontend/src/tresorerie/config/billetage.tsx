import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const billetageDescripteur: Descripteur = {
  titre: "Billetage",
  endpoint: "billetage",
  roleEcriture: ["COMPTABLE", "DAF"],
  colonnes: [
    { cle: "arrete_caisse_date", entete: "Date arrêté", rendu: (ligne) => ligne.arrete_caisse_date || "" },
    { cle: "arrete_caisse_compte_code", entete: "Compte", rendu: (ligne) => ligne.arrete_caisse_compte_code || "" },
    { cle: "denomination", entete: "Dénomination (FCFA)" },
    { cle: "quantite", entete: "Quantité" },
  ],
  champs: [
    { nom: "arrete_caisse", label: "Arrêté de caisse", type: "fk", requis: true, fkEndpoint: "arretes-caisse", fkLabel: (o) => `${o.compte.code} - ${o.date}` },
    { nom: "denomination", label: "Dénomination (FCFA)", type: "number", requis: true, min: 1 },
    { nom: "quantite", label: "Quantité", type: "number", requis: true, min: 0 },
  ],
  schema: z.object({
    arrete_caisse: z.number({ error: "Obligatoire" }),
    denomination: z.number().int().positive(),
    quantite: z.number().int().nonnegative(),
  }),
};