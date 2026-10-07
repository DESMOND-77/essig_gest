import type { RouteObject } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import type { Descripteur } from "../referentiel/descripteur";
import { FicheScolarite } from "./FicheScolarite";
import { SituationPaiement } from "./SituationPaiement";
import { echeanceDescripteur } from "./config/echeance";
import { fraisInscriptionDescripteur } from "./config/fraisInscription";
import { modalitePaiementDescripteur } from "./config/modalitePaiement";
import { bourseDescripteur } from "./config/bourse";
import { typeFraisDescripteur } from "./config/typeFrais";

const paires: readonly (readonly [string, Descripteur])[] = [
  ["modalites-paiement", modalitePaiementDescripteur],
  ["echeances", echeanceDescripteur],
  ["types-frais", typeFraisDescripteur],
  ["frais-inscription", fraisInscriptionDescripteur],
  ["bourses", bourseDescripteur],
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
      {
        path: "fiche-scolarite/:id",
        handle: { miette: "Fiche de scolarité" },
        element: <FicheScolarite />,
      },
    ],
  },
];
