import type { RouteObject } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import type { Descripteur } from "../referentiel/descripteur";
import { enseignantDescripteur } from "./config/enseignant";
import { personnelAdministratifDescripteur } from "./config/personnelAdministratif";
import { affectationEnseignementDescripteur } from "./config/affectationEnseignement";
import { salaireEnseignantDescripteur } from "./config/salaireEnseignant";
import { salaireAdministrationDescripteur } from "./config/salaireAdministration";
import { avancePersonnelDescripteur } from "./config/avancePersonnel";

const paires: readonly (readonly [string, Descripteur])[] = [
  ["enseignants", enseignantDescripteur],
  ["personnel-administratif", personnelAdministratifDescripteur],
  ["affectations-enseignement", affectationEnseignementDescripteur],
  ["salaires-enseignant", salaireEnseignantDescripteur],
  ["salaires-administration", salaireAdministrationDescripteur],
  ["avances-personnel", avancePersonnelDescripteur],
];

export const routesPaie: RouteObject[] = [
  {
    path: "paie",
    handle: { miette: "Paie" },
    children: paires.map(([seg, descr]) => ({
      path: seg,
      handle: { miette: descr.titre },
      element: <ResourcePage descripteur={descr} />,
    })),
  },
];
