import { z } from "zod";
import type { Descripteur } from "../descripteur";

const entierOptionnel = z.union([z.number().int(), z.nan()]).optional();

export const classeDescripteur: Descripteur = {
  titre: "Classes",
  endpoint: "referentiel/classes",
  roleEcriture: ["DIRECTION", "SCOLARITE"],
  rechercheActive: true,
  colonnes: [
    { cle: "libelle_auto", entete: "Libellé" },
    { cle: "effectif_max", entete: "Effectif max" },
  ],
  filtres: [
    { nom: "annee_scolaire", label: "Année", fkEndpoint: "referentiel/annees-scolaires" },
    { nom: "niveau", label: "Niveau", fkEndpoint: "referentiel/niveaux" },
  ],
  champs: [
    { nom: "annee_scolaire", label: "Année scolaire", type: "fk", requis: true, fkEndpoint: "referentiel/annees-scolaires", fkLabel: (o) => String(o.libelle) },
    { nom: "niveau", label: "Niveau", type: "fk", requis: true, fkEndpoint: "referentiel/niveaux", fkLabel: (o) => String(o.code) },
    { nom: "option_filiere", label: "Option de filière", type: "fk", requis: true, fkEndpoint: "referentiel/options-filiere", fkLabel: (o) => String(o.sigle || o.nom) },
    { nom: "modalite_formation", label: "Modalité", type: "fk", requis: true, fkEndpoint: "referentiel/modalites-formation", fkLabel: (o) => String(o.code) },
    { nom: "effectif_max", label: "Effectif maximum", type: "number" },
  ],
  schema: z.object({
    annee_scolaire: z.number({ error: "Obligatoire" }),
    niveau: z.number({ error: "Obligatoire" }),
    option_filiere: z.number({ error: "Obligatoire" }),
    modalite_formation: z.number({ error: "Obligatoire" }),
    effectif_max: entierOptionnel,
  }),
};
