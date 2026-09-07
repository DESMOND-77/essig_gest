import type { RouteObject } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import { FicheEtudiant } from "./FicheEtudiant";
import { etudiantDescripteur } from "./config/etudiant";
import { typePieceDescripteur } from "./config/typePiece";

export const routesPersonnes: RouteObject[] = [
  {
    path: "personnes",
    handle: { miette: "Personnes" },
    children: [
      {
        path: "etudiants",
        handle: { miette: "Étudiants" },
        children: [
          { index: true, element: <ResourcePage descripteur={etudiantDescripteur} /> },
          { path: ":id", handle: { miette: "Fiche" }, element: <FicheEtudiant /> },
        ],
      },
      {
        path: "types-piece",
        handle: { miette: "Types de pièce" },
        element: <ResourcePage descripteur={typePieceDescripteur} />,
      },
    ],
  },
];
