import { NavLink } from "react-router-dom";
import {
  BookOpen,
  Users,
  GraduationCap,
  Wallet,
  ClipboardCheck,
  BarChart3,
  Banknote,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Module = {
  cle: string;
  libelle: string;
  chemin: string;
  disponible: boolean;
  icone: LucideIcon;
};

export const NAV_MODULES: Module[] = [
  { cle: "referentiel", libelle: "Référentiel", chemin: "/referentiel/ecoles", disponible: true, icone: BookOpen },
  { cle: "personnes", libelle: "Personnes", chemin: "/personnes/etudiants", disponible: true, icone: Users },
  { cle: "scolarite", libelle: "Scolarité", chemin: "/scolarite/modalites-paiement", disponible: true, icone: GraduationCap },
  { cle: "tresorerie", libelle: "Trésorerie", chemin: "/tresorerie", disponible: true, icone: Wallet },
  { cle: "evaluations", libelle: "Évaluations", chemin: "/evaluations/evaluations", disponible: true, icone: ClipboardCheck },
  { cle: "resultats", libelle: "Résultats", chemin: "/resultats/resultats-annuels", disponible: true, icone: BarChart3 },
  { cle: "paie", libelle: "Paie", chemin: "/paie/enseignants", disponible: true, icone: Banknote },
];

export function Sidebar() {
  return (
    <nav className="flex h-full flex-col gap-1 p-3 text-sm">
      <div className="flex flex-col gap-0.5 px-2 pb-5">
        <strong className="text-lg font-bold tracking-tight text-sidebar-foreground">ESSIG-GEST</strong>
        <span className="text-[9px] font-bold uppercase tracking-widest text-sidebar-foreground/60">
          Gestion scolaire
        </span>
      </div>
      {NAV_MODULES.map((m) => {
        const Icone = m.icone;
        return m.disponible ? (
          <NavLink
            key={m.cle}
            to={m.chemin}
            className={({ isActive }) =>
              cn(
                "relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-sidebar-foreground/70 transition-colors",
                isActive
                  ? "bg-sidebar-accent/20 font-semibold text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
              )
            }
          >
            <Icone className="size-4 shrink-0" />
            <span>{m.libelle}</span>
          </NavLink>
        ) : (
          <span
            key={m.cle}
            className="flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 text-[13px] text-sidebar-foreground/40"
          >
            <span className="flex items-center gap-3">
              <Icone className="size-4 shrink-0" />
              {m.libelle}
            </span>
            <span className="rounded bg-sidebar-foreground/10 px-1.5 py-0.5 text-[9px] font-bold uppercase">
              à venir
            </span>
          </span>
        );
      })}
    </nav>
  );
}
