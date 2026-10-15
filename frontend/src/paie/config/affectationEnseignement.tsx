import { z } from "zod";
import type { Descripteur } from "../../referentiel/descripteur";

export const affectationEnseignementDescripteur: Descripteur = {
  titre: "Affectations d'enseignement",
  endpoint: "rh-paie/affectations-enseignement",
  roleEcriture: ["COMPTABLE", "DAF"],
  rechercheActive: false,
  colonnes: [
    { cle: "enseignant_nom", entete: "Enseignant" },
    { cle: "matiere_nom", entete: "Matière" },
    { cle: "classe_nom", entete: "Classe" },
    { cle: "annee_scolaire_libelle", entete: "Année" },
    { cle: "volume_horaire_prevu", entete: "Volume horaire" },
    { cle: "montant_prevu", entete: "Montant prévu" },
  ],
  filtres: [
    { nom: "enseignant", label: "Enseignant", fkEndpoint: "rh-paie/enseignants" },
    { nom: "classe", label: "Classe", fkEndpoint: "referentiel/classes" },
    { nom: "annee_scolaire", label: "Année scolaire", fkEndpoint: "referentiel/annees-scolaires" },
  ],
  champs: [
    {
      nom: "enseignant",
      label: "Enseignant",
      type: "fk",
      requis: true,
      fkEndpoint: "rh-paie/enseignants",
      fkLabel: (o) => `${String(o.nom)} ${String(o.prenom)}`,
    },
    {
      nom: "matiere",
      label: "Matière",
      type: "fk",
      requis: true,
      fkEndpoint: "referentiel/matieres",
      fkLabel: (o) => String(o.nom),
    },
    {
      nom: "classe",
      label: "Classe",
      type: "fk",
      requis: true,
      fkEndpoint: "referentiel/classes",
      fkLabel: (o) => String(o.libelle_auto),
    },
    {
      nom: "annee_scolaire",
      label: "Année scolaire",
      type: "fk",
      requis: true,
      fkEndpoint: "referentiel/annees-scolaires",
      fkLabel: (o) => String(o.libelle),
    },
    { nom: "volume_horaire_prevu", label: "Volume horaire prévu", type: "number", requis: true },
    { nom: "taux_horaire", label: "Taux horaire (FCFA)", type: "number", requis: true },
    { nom: "montant_prevu", label: "Montant prévu (FCFA)", type: "number", requis: true },
  ],
  schema: z.object({
    enseignant: z.number({ error: "Obligatoire" }),
    matiere: z.number({ error: "Obligatoire" }),
    classe: z.number({ error: "Obligatoire" }),
    annee_scolaire: z.number({ error: "Obligatoire" }),
    volume_horaire_prevu: z.number({ error: "Obligatoire" }).int().min(1),
    taux_horaire: z.number({ error: "Obligatoire" }).min(0),
    montant_prevu: z.number({ error: "Obligatoire" }).min(0),
  }),
};
