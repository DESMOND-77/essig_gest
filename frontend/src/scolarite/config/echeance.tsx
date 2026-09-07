import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const echeanceDescripteur: Descripteur = {
  titre: "Échéances",
  endpoint: "scolarite/echeances",
  roleEcriture: ["DIRECTION", "DAF", "COMPTABLE"],
  rechercheActive: false,
  colonnes: [
    { cle: "inscription", entete: "Inscription" },
    { cle: "numero", entete: "N°" },
    { cle: "montant_prevu", entete: "Montant prévu" },
    { cle: "date_prevue", entete: "Date prévue" },
    { cle: "pris_en_charge_bourse", entete: "Bourse", rendu: (l) => (l.pris_en_charge_bourse ? "Oui" : "Non") },
  ],
  filtres: [
    { nom: "inscription", label: "Inscription", fkEndpoint: "personnes/inscriptions" },
    {
      nom: "pris_en_charge_bourse",
      label: "Bourse",
      options: [
        { valeur: "true", label: "Oui" },
        { valeur: "false", label: "Non" },
      ],
    },
  ],
  champs: [
    { nom: "inscription", label: "Inscription", type: "fk", requis: true, fkEndpoint: "personnes/inscriptions", fkLabel: (o) => `#${o.numero_ordre} — ${o.etudiant_libelle ?? o.etudiant}` },
    { nom: "numero", label: "Numéro", type: "number", requis: true },
    { nom: "montant_prevu", label: "Montant prévu (FCFA)", type: "number", requis: true },
    { nom: "date_prevue", label: "Date prévue", type: "text", requis: true, aide: "AAAA-MM-JJ" },
    { nom: "pris_en_charge_bourse", label: "Pris en charge par une bourse", type: "checkbox" },
  ],
  schema: z.object({
    inscription: z.number({ error: "Obligatoire" }),
    numero: z.number({ error: "Obligatoire" }).int().nonnegative(),
    montant_prevu: z.number({ error: "Obligatoire" }).int().nonnegative(),
    date_prevue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format AAAA-MM-JJ"),
    pris_en_charge_bourse: z.boolean().optional(),
  }),
};
