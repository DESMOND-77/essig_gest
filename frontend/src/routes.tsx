import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { Dashboard } from "./app/Dashboard";
import { LoginPage } from "./auth/LoginPage";
import { routesEvaluations } from "./evaluations/routes";
import { routesPaie } from "./paie/routes";
import { routesPersonnes } from "./personnes/routes";
import { routesReferentiel } from "./referentiel/routes";
import { routesResultats } from "./resultats/routes";
import { routesScolarite } from "./scolarite/routes";
import { routesTresorerie } from "./tresorerie/routes";

export const router = createBrowserRouter([
  { path: "/connexion", element: <LoginPage /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      ...routesReferentiel,
      ...routesPersonnes,
      ...routesScolarite,
      ...routesTresorerie,
      ...routesEvaluations,
      ...routesResultats,
      ...routesPaie,
    ],
  },
]);
