import { Link, useMatches } from "react-router-dom";

type MiettesHandle = { miette?: string };

export function Breadcrumbs() {
  const matches = useMatches() as { pathname: string; handle?: MiettesHandle }[];
  const items = matches.filter((m) => m.handle?.miette);
  return (
    <nav className="flex gap-1 text-xs text-gray-500" aria-label="Fil d'Ariane">
      {items.map((m, i) => (
        <span key={m.pathname}>
          {i > 0 && <span className="px-1">/</span>}
          <Link to={m.pathname} className="hover:underline">
            {m.handle!.miette}
          </Link>
        </span>
      ))}
    </nav>
  );
}
