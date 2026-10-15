import type { RouteObject } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import type { Descripteur } from "../referentiel/descripteur";
import { deliberationDescripteur } from "./config/deliberation";
import { detteCreditDescripteur } from "./config/detteCredit";
import { resultatAnnuelDescripteur } from "./config/resultatAnnuel";
import { resultatMatiereDescripteur } from "./config/resultatMatiere";
import { resultatPeriodeDescripteur } from "./config/resultatPeriode";

const paires: readonly (readonly [string, Descripteur])[] = [
  ["deliberations", deliberationDescripteur],
  ["dettes-credit", detteCreditDescripteur],
  ["resultats-matiere", resultatMatiereDescripteur],
  ["resultats-periode", resultatPeriodeDescripteur],
  ["resultats-annuels", resultatAnnuelDescripteur],
];

export const routesResultats: RouteObject[] = [
  {
    path: "resultats",
    handle: { miette: "Résultats" },
    children: paires.map(([seg, descr]) => ({
      path: seg,
      handle: { miette: descr.titre },
      element: <ResourcePage descripteur={descr} />,
    })),
  },
];
