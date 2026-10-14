import type { RouteObject } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import type { Descripteur } from "./descripteur";
import { anneeScolaireDescripteur } from "./config/anneeScolaire";
import { classeDescripteur } from "./config/classe";
import { ecoleDescripteur } from "./config/ecole";
import { filiereDescripteur } from "./config/filiere";
import { matiereDescripteur } from "./config/matiere";
import { modaliteFormationDescripteur } from "./config/modaliteFormation";
import { niveauDescripteur } from "./config/niveau";
import { optionFiliereDescripteur } from "./config/optionFiliere";
import { periodeDescripteur } from "./config/periode";
import { sessionExamenDescripteur } from "./config/sessionExamen";

const paires: readonly (readonly [string, Descripteur])[] = [
  ["ecoles", ecoleDescripteur],
  ["annees-scolaires", anneeScolaireDescripteur],
  ["modalites-formation", modaliteFormationDescripteur],
  ["niveaux", niveauDescripteur],
  ["filieres", filiereDescripteur],
  ["options-filiere", optionFiliereDescripteur],
  ["classes", classeDescripteur],
  ["matieres", matiereDescripteur],
  ["periodes", periodeDescripteur],
  ["sessions-examen", sessionExamenDescripteur],
];

export const routesReferentiel: RouteObject[] = [
  {
    path: "referentiel",
    handle: { miette: "Référentiel" },
    children: paires.map(([seg, descr]) => ({
      path: seg,
      handle: { miette: descr.titre },
      element: <ResourcePage descripteur={descr} />,
    })),
  },
];
