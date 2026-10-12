import type { RouteObject } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import type { Descripteur } from "../referentiel/descripteur";
import { SituationPaiement } from "./SituationPaiement";
import { echeanceDescripteur } from "./config/echeance";
import { modalitePaiementDescripteur } from "./config/modalitePaiement";

const paires: readonly (readonly [string, Descripteur])[] = [
  ["modalites-paiement", modalitePaiementDescripteur],
  ["echeances", echeanceDescripteur],
];

export const routesScolarite: RouteObject[] = [
  {
    path: "scolarite",
    handle: { miette: "Scolarité" },
    children: [
      // Pages CRUD standard via ResourcePage
      ...paires.map(([seg, descr]) => ({
        path: seg,
        handle: { miette: descr.titre },
        element: <ResourcePage descripteur={descr} />,
      })),

      // Pages spéciales
      {
        path: "situation-paiement",
        handle: { miette: "Situation de paiement" },
        element: <SituationPaiement />,
      },
    ],
  },
];