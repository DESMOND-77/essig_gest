# Intégration design essig_front — Phase 1 (socle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port essig_front's color palette and shared shell visuals (sidebar, topbar, dashboard cards) into `frontend/`'s existing Tailwind v4 + shadcn design-token system, without changing shell component behavior or breaking existing tests.

**Architecture:** Replace the `:root` color tokens in `src/index.css` with oklch equivalents of essig_front's palette, add a few custom tokens (sidebar, warning/danger/violet) exposed via `@theme inline`, add `lucide-react` for icons, then restyle `AppShell`/`Sidebar`/`Topbar`/`Dashboard`/`Chip` in place and add a new `components/ui/card.tsx` primitive. `.dark` theme and all component props/behavior are untouched.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (`@theme inline` + CSS vars), shadcn "new-york" style, class-variance-authority, lucide-react (new), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-16-essig-design-integration-phase1-design.md`

## Global Constraints

- `.dark` theme in `src/index.css` must not change (user decision: keep current neutral dark theme).
- No change to component props, data flow, or behavior (auth, logout, query keys, nav paths) — only visuals.
- Existing tests in `src/app/*.test.tsx` and `src/components/*.test.tsx` (if any) must keep passing without modification, since they assert text/roles/attributes, not CSS classes.
- Use `cn()` from `src/lib/utils.ts` for conditional classNames, matching existing `button.tsx` convention.
- Icon library: `lucide-react` (already declared in `components.json`'s `iconLibrary`, must be installed).

---

### Task 1: Color tokens + lucide-react dependency

**Files:**
- Modify: `src/index.css`
- Modify: `package.json` (add `lucide-react`)
- Test: manual (no unit test for CSS values) — verified via Task 2's visual check and full suite run at end of Task 1.

**Interfaces:**
- Consumes: nothing.
- Produces: CSS variables consumed by all later tasks: `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--card`, `--popover`, plus new custom tokens `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--warning`, `--warning-foreground`, `--danger`, `--danger-foreground`, `--violet`, `--violet-foreground`, each also exposed as `--color-*` in `@theme inline` (so Tailwind utilities like `bg-sidebar`, `text-warning` work).

- [ ] **Step 1: Install lucide-react**

Run: `npm install lucide-react`

- [ ] **Step 2: Verify it installed**

Run: `grep lucide-react package.json`
Expected: a line like `"lucide-react": "^0.xxx.x"` under `dependencies`.

- [ ] **Step 3: Replace `:root` light tokens in `src/index.css`**

Replace the existing `:root { ... }` block (lines 5-26) with:

```css
:root {
  --background: oklch(0.98 0.004 247);
  --foreground: oklch(0.26 0.045 252);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.26 0.045 252);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.26 0.045 252);
  --primary: oklch(0.64 0.11 166);
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.96 0.006 247);
  --secondary-foreground: oklch(0.26 0.045 252);
  --muted: oklch(0.96 0.006 247);
  --muted-foreground: oklch(0.53 0.03 247);
  --accent: oklch(0.96 0.006 247);
  --accent-foreground: oklch(0.26 0.045 252);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.93 0.008 247);
  --input: oklch(0.93 0.008 247);
  --ring: oklch(0.72 0.08 166);
  --radius: 0.625rem;

  --sidebar: oklch(0.19 0.035 256);
  --sidebar-foreground: oklch(0.82 0.02 247);
  --sidebar-accent: oklch(0.64 0.11 166);
  --sidebar-accent-foreground: oklch(0.95 0.03 166);

  --warning: oklch(0.78 0.11 75);
  --warning-foreground: oklch(0.26 0.045 252);
  --danger: oklch(0.68 0.11 15);
  --danger-foreground: oklch(0.99 0 0);
  --violet: oklch(0.63 0.11 290);
  --violet-foreground: oklch(0.99 0 0);
}
```

(`.dark { ... }` block below it is left exactly as-is.)

- [ ] **Step 4: Expose new tokens in `@theme inline`**

In the existing `@theme inline { ... }` block, after the `--color-ring: var(--ring);` line, add:

```css
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-danger: var(--danger);
  --color-danger-foreground: var(--danger-foreground);
  --color-violet: var(--violet);
  --color-violet-foreground: var(--violet-foreground);
```

- [ ] **Step 5: Run the full test suite to confirm nothing broke**

Run: `npx vitest run`
Expected: all existing tests still PASS (CSS-only change, no component logic touched yet).

- [ ] **Step 6: Commit**

```bash
git add src/index.css package.json package-lock.json
git commit -m "feat(frontend): porter la palette essig_front dans les tokens shadcn"
```

---

### Task 2: `components/ui/card.tsx` primitive

**Files:**
- Create: `src/components/ui/card.tsx`
- Test: `src/components/ui/card.test.tsx`

**Interfaces:**
- Consumes: `cn` from `src/lib/utils.ts`.
- Produces: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` — React components forwarding `className` and all native `div` props, used by Task 5 (`Dashboard.tsx`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/card.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

describe("Card", () => {
  it("rend le titre et le contenu", () => {
    render(
      <Card data-testid="carte">
        <CardHeader>
          <CardTitle>Titre</CardTitle>
        </CardHeader>
        <CardContent>Contenu</CardContent>
      </Card>,
    );
    expect(screen.getByTestId("carte")).toBeInTheDocument();
    expect(screen.getByText("Titre")).toBeInTheDocument();
    expect(screen.getByText("Contenu")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/card.test.tsx`
Expected: FAIL — `Cannot find module './card'`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/ui/card.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-4", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-medium text-muted-foreground", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-4 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/card.tsx src/components/ui/card.test.tsx
git commit -m "feat(frontend): ajouter la primitive Card partagée"
```

---

### Task 3: Restyle `Sidebar.tsx`

**Files:**
- Modify: `src/app/Sidebar.tsx`
- Test: `src/app/Sidebar.test.tsx` (existing, must keep passing unmodified)

**Interfaces:**
- Consumes: `NAV_MODULES` (unchanged shape: `{ cle, libelle, chemin, disponible }`), `cn` from `src/lib/utils.ts`, icons from `lucide-react`.
- Produces: `Sidebar` component, same export, same rendered links/text used by `AppShell.tsx` (Task 4) and `AppShell.test.tsx`.

- [ ] **Step 1: Run existing test first to confirm current baseline passes**

Run: `npx vitest run src/app/Sidebar.test.tsx`
Expected: PASS (baseline, before changes).

- [ ] **Step 2: Rewrite `src/app/Sidebar.tsx`**

```tsx
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
```

- [ ] **Step 3: Run test to verify it still passes**

Run: `npx vitest run src/app/Sidebar.test.tsx`
Expected: PASS (same links/text, only classes/icons changed).

- [ ] **Step 4: Commit**

```bash
git add src/app/Sidebar.tsx
git commit -m "feat(frontend): restyler Sidebar selon le design essig_front"
```

---

### Task 4: Restyle `AppShell.tsx`

**Files:**
- Modify: `src/app/AppShell.tsx`
- Test: `src/app/AppShell.test.tsx` (existing, must keep passing unmodified)

**Interfaces:**
- Consumes: `Sidebar` (Task 3), `Topbar` (Task 5 — written in parallel conceptually, but `Topbar.tsx`'s props/exports are unchanged, so this task can proceed independently), `RequireAuth`, `ToastProvider`, `Outlet` — all unchanged signatures.
- Produces: `AppShell` component, same export and behavior, consumed by the router config (not modified in this plan).

- [ ] **Step 1: Run existing test first to confirm current baseline passes**

Run: `npx vitest run src/app/AppShell.test.tsx`
Expected: PASS (baseline).

- [ ] **Step 2: Rewrite `src/app/AppShell.tsx`**

```tsx
import { Outlet } from "react-router-dom";
import { RequireAuth } from "../auth/RequireAuth";
import { ToastProvider } from "../components/ToastProvider";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <RequireAuth>
      <ToastProvider>
        <div className="min-h-screen bg-background">
          <aside className="fixed inset-y-0 left-0 z-40 w-[254px] overflow-y-auto bg-sidebar">
            <Sidebar />
          </aside>
          <div className="ml-[254px] flex min-h-screen flex-col">
            <Topbar />
            <main className="flex-1 p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </ToastProvider>
    </RequireAuth>
  );
}
```

- [ ] **Step 3: Run test to verify it still passes**

Run: `npx vitest run src/app/AppShell.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/AppShell.tsx
git commit -m "feat(frontend): passer AppShell en sidebar fixe (design essig_front)"
```

---

### Task 5: Restyle `Topbar.tsx` and `Breadcrumbs.tsx`

**Files:**
- Modify: `src/app/Topbar.tsx`
- Modify: `src/app/Breadcrumbs.tsx`
- Test: `src/app/AppShell.test.tsx` (covers Topbar indirectly via "dupont" text assertion — must keep passing unmodified; no dedicated `Topbar.test.tsx` exists)

**Interfaces:**
- Consumes: `useAuth` from `../auth/AuthContext` (unchanged: `{ utilisateur, deconnexion }`), `Breadcrumbs`.
- Produces: `Topbar` component, same export/behavior, used by `AppShell.tsx` (Task 4, already wired).

- [ ] **Step 1: Run `AppShell.test.tsx` first to confirm current baseline passes**

Run: `npx vitest run src/app/AppShell.test.tsx`
Expected: PASS (baseline).

- [ ] **Step 2: Rewrite `src/app/Breadcrumbs.tsx`**

```tsx
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
```

- [ ] **Step 3: Rewrite `src/app/Topbar.tsx`**

```tsx
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
```

- [ ] **Step 4: Run test to verify it still passes**

Run: `npx vitest run src/app/AppShell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/Topbar.tsx src/app/Breadcrumbs.tsx
git commit -m "feat(frontend): restyler Topbar et Breadcrumbs selon le design essig_front"
```

---

### Task 6: Restyle `Dashboard.tsx` with the new `Card` primitive

**Files:**
- Modify: `src/app/Dashboard.tsx`
- Test: `src/app/Dashboard.test.tsx` (existing, must keep passing unmodified)

**Interfaces:**
- Consumes: `Card`, `CardHeader`, `CardTitle`, `CardContent` from `../components/ui/card` (Task 2), `DataState`, `Chip` (unchanged), `apiFetch`, `jsonOuLeve` (unchanged).
- Produces: `Dashboard` component, same export, same data rendering, used by the router (not modified in this plan).

- [ ] **Step 1: Run existing test first to confirm current baseline passes**

Run: `npx vitest run src/app/Dashboard.test.tsx`
Expected: PASS (baseline).

- [ ] **Step 2: Rewrite `src/app/Dashboard.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import { jsonOuLeve } from "../lib/resource";
import { DataState } from "../components/DataState";
import { Chip } from "../components/Chip";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

type TableauDeBord = {
  annee_scolaire_id: number | null;
  annee_scolaire_libelle: string | null;
  etudiants_inscrits: number;
  encaissements: string;
  reste_a_recouvrer: string;
  depenses: string;
  solde_comptes: number | string;
  masse_salariale: string;
  resultats_par_decision: Record<string, number>;
  alertes: {
    echeances_en_retard: number;
    arretes_caisse_en_ecart: number;
  };
};

function formaterFCFA(valeur: string | number): string {
  const n = Number(valeur);
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

function Carte({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle>{titre}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xl font-semibold text-foreground">{valeur}</div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["rapports", "tableau-de-bord"],
    queryFn: () =>
      apiFetch("/rapports/tableau-de-bord/").then(jsonOuLeve) as Promise<TableauDeBord>,
  });

  if (isLoading) return <DataState statut="chargement" />;
  if (isError || !data) return <DataState statut="erreur" onReessayer={refetch} />;

  const nbAlertes = data.alertes.echeances_en_retard + data.alertes.arretes_caisse_en_ecart;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          {data.annee_scolaire_libelle
            ? `Année scolaire courante : ${data.annee_scolaire_libelle}`
            : "Aucune année scolaire courante définie — indicateurs sur l'ensemble des données."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Carte titre="Étudiants inscrits" valeur={String(data.etudiants_inscrits)} />
        <Carte titre="Encaissements" valeur={formaterFCFA(data.encaissements)} />
        <Carte titre="Reste à recouvrer" valeur={formaterFCFA(data.reste_a_recouvrer)} />
        <Carte titre="Dépenses" valeur={formaterFCFA(data.depenses)} />
        <Carte titre="Solde des comptes" valeur={formaterFCFA(data.solde_comptes)} />
        <Carte titre="Masse salariale" valeur={formaterFCFA(data.masse_salariale)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">Résultats (délibérés)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {Object.keys(data.resultats_par_decision).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun résultat annuel délibéré pour le moment.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.resultats_par_decision).map(([decision, nb]) => (
                <span key={decision} className="flex items-center gap-1 text-sm">
                  <Chip
                    variante={
                      decision === "ADMIS"
                        ? "success"
                        : decision === "REDOUBLE" || decision === "EXCLU"
                          ? "error"
                          : "warning"
                    }
                    label={decision}
                  />
                  <span className="text-muted-foreground">× {nb}</span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-foreground">Alertes administratives</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {nbAlertes === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune alerte.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.alertes.echeances_en_retard > 0 && (
                <li>
                  <Chip variante="warning" label={String(data.alertes.echeances_en_retard)} />{" "}
                  échéance(s) en retard
                </li>
              )}
              {data.alertes.arretes_caisse_en_ecart > 0 && (
                <li>
                  <Chip variante="error" label={String(data.alertes.arretes_caisse_en_ecart)} />{" "}
                  arrêté(s) de caisse en écart
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
```

- [ ] **Step 3: Run test to verify it still passes**

Run: `npx vitest run src/app/Dashboard.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/Dashboard.tsx
git commit -m "feat(frontend): restyler Dashboard avec la primitive Card"
```

---

### Task 7: Remap `Chip.tsx` to the new palette

**Files:**
- Modify: `src/components/Chip.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Chip` component, same export and props (`variante`, `label`), already consumed by `Dashboard.tsx` (Task 6) with no interface change — so no test depends on exact classNames here.

- [ ] **Step 1: Rewrite `src/components/Chip.tsx`**

```tsx
type Variante = "success" | "warning" | "error" | "info";

interface ChipProps {
  variante: Variante;
  label: string;
}

export const Chip = ({ variante, label }: ChipProps) => {
  const getVariantClasses = (v: Variante) => {
    switch (v) {
      case "success":
        return "bg-primary/15 text-primary";
      case "warning":
        return "bg-warning/20 text-warning-foreground";
      case "error":
        return "bg-danger/15 text-danger";
      case "info":
        return "bg-violet/15 text-violet";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <span
      className={`inline-flex px-2 text-xs font-semibold leading-5 rounded-full ${getVariantClasses(
        variante,
      )}`}
    >
      {label}
    </span>
  );
};
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS (Chip has no dedicated test file; this is covered transitively by `Dashboard.test.tsx`, which asserts text content, not classes).

- [ ] **Step 3: Commit**

```bash
git add src/components/Chip.tsx
git commit -m "feat(frontend): remapper les variantes de Chip sur la palette essig_front"
```

---

### Task 8: Final full-suite verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS, zero regressions across `src/app/*.test.tsx` and any other existing suites.

- [ ] **Step 2: Run the linter**

Run: `npx oxlint`
Expected: no new errors introduced by this plan's changes (pre-existing issues, if any, are out of scope).

- [ ] **Step 3: Start the dev server and visually confirm**

Run: `npm run dev`, open the app, log in, and confirm: dark navy fixed sidebar with teal active indicator, sticky translucent topbar with breadcrumb + avatar, dashboard cards with the new palette, status chips in teal/amber/red/violet.

- [ ] **Step 4: Stop the dev server**

No commit for this task (verification only, no file changes).
