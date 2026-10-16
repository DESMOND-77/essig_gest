import { LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Breadcrumbs } from "./Breadcrumbs";

export function Topbar() {
  const { utilisateur, deconnexion } = useAuth();
  const initiales = (utilisateur?.login ?? "?").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-border bg-background/95 px-9 backdrop-blur">
      <Breadcrumbs />
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-left">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
            {initiales}
          </span>
          <span className="text-sm font-medium text-foreground">{utilisateur?.login}</span>
        </div>
        <button
          onClick={() => deconnexion()}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="size-3.5" />
          Déconnexion
        </button>
      </div>
    </header>
  );
}
