import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const resultatAnnuelDescripteur: Descripteur = {
  titre: "Résultats annuels",
  endpoint: "resultats/resultats-annuels",
  roleEcriture: [],
  rechercheActive: true,
  colonnes: [
    { cle: "regime", entete: "Régime" },
    { cle: "moyenne_annuelle", entete: "Moyenne annuelle" },
    { cle: "credits_acquis", entete: "Crédits acquis" },
    { cle: "decision", entete: "Décision" },
    { cle: "mention", entete: "Mention" },
  ],
  filtres: [
    { nom: "inscription", label: "Inscription", fkEndpoint: "personnes/inscriptions" },
    { nom: "annee_scolaire", label: "Année scolaire", fkEndpoint: "referentiel/annees-scolaires" },
    {
      nom: "decision",
      label: "Décision",
      options: [
        { valeur: "ADMIS", label: "Admis" },
        { valeur: "ADMIS_CONDITIONNEL", label: "Admis conditionnel" },
        { valeur: "REDOUBLE", label: "Redouble" },
        { valeur: "EXCLU", label: "Exclu" },
        { valeur: "AJOURNE", label: "Ajourné" },
      ],
    },
  ],
  champs: [],
  schema: z.object({}),
};
