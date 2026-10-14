import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const mouvementDescripteur: Descripteur = {
  titre: "Mouvements",
  endpoint: "tresorerie/mouvements",
  roleEcriture: [], // Lecture seule
  colonnes: [
    { cle: "date_operation", entete: "Date d'opération" },
    { cle: "compte_libelle", entete: "Compte", rendu: (ligne) => ligne.compte_libelle || "" },
    { cle: "sens", entete: "Sens" },
    { cle: "montant", entete: "Montant (FCFA)" },
    { cle: "categorie_mouvement_libelle", entete: "Catégorie", rendu: (ligne) => ligne.categorie_mouvement_libelle || "" },
    { cle: "libelle", entete: "Libellé" },
    { cle: "reference_piece", entete: "Référence de pièce", rendu: (ligne) => ligne.reference_piece || "" },
  ],
  champs: [], // Aucun champ en lecture seule
  schema: z.object({}), // Schéma vide car aucun champ modifiable
  rechercheActive: false,
};