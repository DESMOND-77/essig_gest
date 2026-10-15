import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const resultatMatiereDescripteur: Descripteur = {
  titre: "Résultats par matière",
  endpoint: "resultats/resultats-matiere",
  roleEcriture: [],
  rechercheActive: false,
  colonnes: [
    { cle: "note_normale", entete: "Note normale" },
    { cle: "note_rattrapage", entete: "Note rattrapage" },
    { cle: "note_retenue", entete: "Note retenue" },
    { cle: "credits", entete: "Crédits" },
    { cle: "validee", entete: "Validée" },
  ],
  filtres: [
    { nom: "inscription", label: "Inscription", fkEndpoint: "personnes/inscriptions" },
    { nom: "matiere", label: "Matière", fkEndpoint: "referentiel/matieres" },
    { nom: "periode", label: "Période", fkEndpoint: "referentiel/periodes" },
  ],
  champs: [],
  schema: z.object({}),
};
