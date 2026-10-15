import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const detteCreditDescripteur: Descripteur = {
  titre: "Dettes de crédits",
  endpoint: "resultats/dettes-credit",
  roleEcriture: ["SCOLARITE", "DIRECTION"],
  rechercheActive: false,
  colonnes: [
    { cle: "credits", entete: "Crédits" },
    { cle: "soldee", entete: "Soldée" },
  ],
  filtres: [
    { nom: "inscription_origine", label: "Inscription d'origine", fkEndpoint: "personnes/inscriptions" },
    { nom: "matiere", label: "Matière", fkEndpoint: "referentiel/matieres" },
    { nom: "soldee", label: "Soldée", options: [
      { valeur: "true", label: "Oui" },
      { valeur: "false", label: "Non" },
    ] },
  ],
  champs: [
    {
      nom: "inscription_origine",
      label: "Inscription d'origine",
      type: "fk",
      requis: true,
      fkEndpoint: "personnes/inscriptions",
      fkLabel: (o) => `#${o.id}`,
    },
    {
      nom: "matiere",
      label: "Matière",
      type: "fk",
      requis: true,
      fkEndpoint: "referentiel/matieres",
      fkLabel: (o) => String(o.code),
    },
    {
      nom: "annee_origine",
      label: "Année d'origine",
      type: "fk",
      requis: true,
      fkEndpoint: "referentiel/annees-scolaires",
      fkLabel: (o) => String(o.libelle),
    },
    { nom: "credits", label: "Crédits", type: "number", requis: true },
  ],
  schema: z.object({
    inscription_origine: z.number({ error: "Obligatoire" }),
    matiere: z.number({ error: "Obligatoire" }),
    annee_origine: z.number({ error: "Obligatoire" }),
    credits: z.number({ error: "Obligatoire" }).int(),
  }),
};
