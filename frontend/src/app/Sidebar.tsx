import { NavLink } from "react-router-dom";

type Module = { cle: string; libelle: string; chemin: string; disponible: boolean };

export const NAV_MODULES: Module[] = [
  { cle: "referentiel", libelle: "Référentiel", chemin: "/referentiel/ecoles", disponible: true },
  { cle: "personnes", libelle: "Personnes", chemin: "/personnes", disponible: false },
  { cle: "scolarite", libelle: "Scolarité", chemin: "/scolarite", disponible: false },
  { cle: "tresorerie", libelle: "Trésorerie", chemin: "/tresorerie", disponible: false },
  { cle: "paie", libelle: "Paie", chemin: "/paie", disponible: false },
  { cle: "resultats", libelle: "Résultats", chemin: "/resultats", disponible: false },
];

export function Sidebar() {
  return (
    <nav className="flex flex-col gap-1 p-3 text-sm">
      <span className="px-2 pb-2 font-semibold text-gray-500">ESSIG-GEST</span>
      {NAV_MODULES.map((m) =>
        m.disponible ? (
          <NavLink
            key={m.cle}
            to={m.chemin}
            className={({ isActive }) =>
              `rounded px-2 py-1.5 ${isActive ? "bg-gray-200 font-medium" : "hover:bg-gray-100"}`
            }
          >
            {m.libelle}
          </NavLink>
        ) : (
          <span
            key={m.cle}
            className="flex items-center justify-between rounded px-2 py-1.5 text-gray-400"
          >
            {m.libelle}
            <span className="text-[10px] uppercase">à venir</span>
          </span>
        ),
      )}
    </nav>
  );
}
