import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const imputationEncaissementDescripteur: Descripteur = {
  titre: "Imputations d'encaissement",
  endpoint: "tresorerie/imputations-encaissement",
  roleEcriture: [], // Lecture seule
  colonnes: [
    { cle: "encaissement_recu_numero", entete: "Encaissement", rendu: (ligne) => ligne.encaissement_recu_numero || "" },
    { cle: "cible", entete: "Cible" },
    { cle: "echeance_libelle", entete: "Échéance", rendu: (ligne) => ligne.echeance_libelle || "" },
    { cle: "frais_inscription_libelle", entete: "Frais d'inscription", rendu: (ligne) => ligne.frais_inscription_libelle || "" },
    { cle: "montant", entete: "Montant imputé (FCFA)" },
    { cle: "date_operation", entete: "Date", rendu: (ligne) => ligne.date_operation || "" },
  ],
  champs: [], // Aucun champ en lecture seule
  schema: z.object({}), // Schéma vide car aucun champ modifiable
  rechercheActive: false,
};