import type { RouteObject } from "react-router-dom";
import { ResourcePage } from "../components/ResourcePage";
import type { Descripteur } from "../referentiel/descripteur";
import { evaluationDescripteur } from "./config/evaluation";
import { noteEvaluationDescripteur } from "./config/noteEvaluation";

const paires: readonly (readonly [string, Descripteur])[] = [
  ["evaluations", evaluationDescripteur],
  ["notes", noteEvaluationDescripteur],
];

export const routesEvaluations: RouteObject[] = [
  {
    path: "evaluations",
    handle: { miette: "Évaluations" },
    children: paires.map(([seg, descr]) => ({
      path: seg,
      handle: { miette: descr.titre },
      element: <ResourcePage descripteur={descr} />,
    })),
  },
];
