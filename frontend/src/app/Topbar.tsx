import { useAuth } from "../auth/AuthContext";
import { Breadcrumbs } from "./Breadcrumbs";

export function Topbar() {
  const { utilisateur, deconnexion } = useAuth();
  return (
    <header className="flex items-center justify-between border-b px-4 py-2">
      <Breadcrumbs />
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-600">{utilisateur?.login}</span>
        <button onClick={() => deconnexion()} className="rounded border px-2 py-1">
          Déconnexion
        </button>
      </div>
    </header>
  );
}
