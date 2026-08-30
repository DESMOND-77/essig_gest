import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "./auth/LoginPage";
import { RequireAuth } from "./auth/RequireAuth";

export const router = createBrowserRouter([
  { path: "/connexion", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <main className="p-8">
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-gray-600">Socle en place. Modules à venir.</p>
        </main>
      </RequireAuth>
    ),
  },
]);
