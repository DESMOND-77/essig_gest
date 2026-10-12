import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const arreteCaisseDescripteur: Descripteur = {
  titre: "Arrêtés de caisse",
  endpoint: "arretes-caisse",
  roleEcriture: ["COMPTABLE", "DAF"],
  colonnes: [
    { cle: "compte_code", entete: "Compte", rendu: (ligne) => ligne.compte_code || "" },
    { cle: "date", entete: "Date" },
    { cle: "solde_theorique", entete: "Solde théorique (FCFA)" },
    { cle: "solde_physique", entete: "Solde physique (FCFA)" },
    { cle: "ecart", entete: "Écart (FCFA)", rendu: (ligne) => ligne.ecart?.toString() || "0" },
    { cle: "statut", entete: "Statut" },
    { cle: "fait_par_nom", entete: "Fait par", rendu: (ligne) => ligne.fait_par_nom || "" },
    { cle: "valide_par_nom", entete: "Validé par", rendu: (ligne) => ligne.valide_par_nom || "" },
  ],
  champs: [
    { nom: "compte", label: "Compte de caisse", type: "fk", requis: true, fkEndpoint: "comptes", fkLabel: (o) => `${o.code} - ${o.libelle}` },
    { nom: "date", label: "Date", type: "date", requis: true },
    { nom: "solde_physique", label: "Solde physique (FCFA)", type: "number", requis: true, min: 0 },
    { nom: "observations", label: "Observations", type: "text" },
  ],
  schema: z.object({
    compte: z.number({ error: "Obligatoire" }),
    date: z.date({ error: "Date invalide" }),
    solde_physique: z.number().int().nonnegative(),
    observations: z.string().max(255).optional(),
  }),
};