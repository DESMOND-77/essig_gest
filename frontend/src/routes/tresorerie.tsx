import type { RouteObject } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import type { Descripteur } from "../referentiel/descripteur";

// TODO: Import actual descriptors and components when implementing phase 5
// import { tresorerieDescripteur } from "./config/tresorerie";
// import { autreDescripteur } from "./config/autre";
// import { ComposantSpecifique } from "./ComposantSpecifique";

// Placeholder descriptors for phase 5 preparation
const placeholderDescripteur: Descripteur = {
  titre: "TODO: Phase 5 Tresorerie",
  entete: "TODO",
  cle: "todo",
  // TODO: Add other required Descripteur properties when implementing
} as Descripteur;

const paires: readonly (readonly [string, Descripteur])[] = [
  // TODO: Replace with actual entity descriptors when implementing phase 5
  // ["entity-name", entityDescripteur],
];

export const routesTresorerie: RouteObject[] = [
  {
    path: "tresorerie",
    handle: { miette: "Trésorerie" },
    children: [
      // Pages CRUD standard via ResourcePage
      ...paires.map(([seg, descr]) => ({
        path: seg,
        handle: { miette: descr.titre },
        element: <ResourcePage descripteur={descr} />,
      })),
      
      // Pages spéciales (to be implemented in phase 5)
      // {
      //   path: "special-page",
      //   handle: { miette: "Page Spéciale" },
      //   element: <ComposantSpecifique />,
      // },
    ],
  },
];
