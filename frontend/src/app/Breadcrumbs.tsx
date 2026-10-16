import { Link, useMatches } from "react-router-dom";

type MiettesHandle = { miette?: string };

export function Breadcrumbs() {
  const matches = useMatches() as { pathname: string; handle?: MiettesHandle }[];
  const items = matches.filter((m) => m.handle?.miette);
  return (
    <nav className="flex items-center gap-2 text-[11px] text-muted-foreground" aria-label="Fil d'Ariane">
      {items.map((m, i) => (
        <span key={m.pathname} className="flex items-center gap-2">
          {i > 0 && <span className="text-border">/</span>}
          <Link to={m.pathname} className="font-medium text-foreground hover:underline">
            {m.handle!.miette}
          </Link>
        </span>
      ))}
    </nav>
  );
}
