import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const resultatPeriodeDescripteur: Descripteur = {
  titre: "Résultats par période",
  endpoint: "resultats/resultats-periode",
  roleEcriture: [],
  rechercheActive: false,
  colonnes: [
    { cle: "moyenne_ponderee", entete: "Moyenne pondérée" },
    { cle: "credits_acquis", entete: "Crédits acquis" },
    { cle: "rang", entete: "Rang" },
  ],
  filtres: [
    { nom: "inscription", label: "Inscription", fkEndpoint: "personnes/inscriptions" },
    { nom: "periode", label: "Période", fkEndpoint: "referentiel/periodes" },
  ],
  champs: [],
  schema: z.object({}),
};
