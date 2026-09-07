import type { RouteObject } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import { FicheEtudiant } from "./FicheEtudiant";
import { FicheInscription } from "./FicheInscription";
import { etudiantDescripteur } from "./config/etudiant";
import { inscriptionDescripteur } from "./config/inscription";
import { pieceDossierDescripteur } from "./config/pieceDossier";
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
      {
        path: "inscriptions",
        handle: { miette: "Inscriptions" },
        children: [
          { index: true, element: <ResourcePage descripteur={inscriptionDescripteur} /> },
          { path: ":id", handle: { miette: "Fiche" }, element: <FicheInscription /> },
        ],
      },
      {
        path: "pieces-dossier",
        handle: { miette: "Pièces du dossier" },
        element: <ResourcePage descripteur={pieceDossierDescripteur} />,
      },
    ],
  },
];
