import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { utilisateur, chargement } = useAuth();
  if (chargement) return <p className="p-8">Chargement…</p>;
  if (!utilisateur) return <Navigate to="/connexion" replace />;
  return <>{children}</>;
}
