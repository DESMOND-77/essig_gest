import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./app/AppShell";
import { LoginPage } from "./auth/LoginPage";
import { routesPersonnes } from "./personnes/routes";
import { routesReferentiel } from "./referentiel/routes";
import { routesScolarite } from "./scolarite/routes";
import { routesTresorerie } from "./tresorerie/routes";

export const router = createBrowserRouter([
  { path: "/connexion", element: <LoginPage /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <p className="text-gray-600">Bienvenue. Choisissez un module.</p> },
      ...routesReferentiel,
      ...routesPersonnes,
      ...routesScolarite,
      ...routesTresorerie,
    ],
  },
]);
