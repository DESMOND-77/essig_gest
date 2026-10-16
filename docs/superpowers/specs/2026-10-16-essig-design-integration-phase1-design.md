# Intégration design essig_front — Phase 1 (socle : tokens + shell)

## Contexte

`frontend/` est une app React/TS modulaire (Tailwind v4 + shadcn "new-york", 95 fichiers `.tsx`, testée) avec 7 modules métier (personnes, paie, scolarité, trésorerie, résultats, évaluations, référentiel). Elle utilise actuellement les tokens shadcn neutres par défaut et des composants `AppShell`/`Sidebar`/`Topbar`/`Dashboard`/`Breadcrumbs` fonctionnels mais non stylés.

`/home/foxtrot/Téléchargements/essig_front/` est un prototype React monolithique (CSS brut, pas de Tailwind) qui définit le design cible : palette navy/teal, sidebar fixe sombre, topbar translucide, cartes de dashboard, badges de statut.

Objectif de cette phase : porter la palette et les composants partagés (shell) dans `frontend/`, sans toucher aux pages métier (phase 2, hors scope).

## Palette (src/index.css)

Convertir les couleurs essig_front en variables oklch, en conservant la structure `@theme inline` existante. Le thème `.dark` n'est pas modifié (décision utilisateur : conserver le gris neutre actuel).

Mapping `:root` :
- `--background`: `#f5f7fb`
- `--foreground`: `#17233b` (ink)
- `--card` / `--popover`: `#ffffff`
- `--primary`: `#22b89b` (teal) / `--primary-foreground`: blanc
- `--muted-foreground`: `#63718a` (ink-soft)
- `--border` / `--input`: `#e8ecf2` (line)
- `--ring`: teal clair

Nouveaux tokens custom (ajoutés dans `:root` et exposés dans `@theme inline`) :
- `--sidebar` / `--sidebar-foreground`: navy (`#111c34`) / `#c5cee0`
- `--sidebar-accent` (teal, pour l'item sélectionné)
- `--warning`, `--danger`, `--violet` (pour badges/notifications, repris de `--amber`, `--danger`, `--violet` d'essig_front)

## Dépendance

Ajouter `lucide-react` (déjà déclaré comme `iconLibrary` dans `components.json`, non installé). Nécessaire pour les icônes de sidebar/topbar.

## Composants

### `components/ui/card.tsx` (nouveau)
Primitive shadcn standard (Card, CardHeader, CardTitle, CardContent...) suivant le style `new-york`. Sert de base pour `Dashboard`.

### `app/AppShell.tsx`
Remplacer le grid `220px_1fr` par sidebar fixe (`position: fixed`, largeur ~254px) + colonne principale avec `margin-left`, pour matcher la structure `.app-shell`/`.sidebar`/`.main-shell` d'essig_front. Comportement (RequireAuth, ToastProvider, Outlet) inchangé.

### `app/Sidebar.tsx`
- Ajouter un bandeau marque ("ESSIG-GEST" + sous-titre) en haut.
- Chaque item de `NAV_MODULES` reçoit une icône `lucide-react` (mapping simple clé→icône).
- Item actif : fond dégradé teal + barre latérale teal (`::before` équivalent via `relative` + pseudo-élément Tailwind ou élément absolu).
- Items non disponibles : badge "à venir" stylé (déjà existant fonctionnellement, juste restylé).
- Les tests existants (`Sidebar.test.tsx`) vérifient les liens/libellés, pas les classes — ne doivent pas casser.

### `app/Topbar.tsx`
- Header sticky, fond translucide (`backdrop-blur`), bordure basse fine.
- `Breadcrumbs` existant conservé tel quel côté logique, restylé via classes.
- Zone utilisateur : avatar (initiales) + nom + bouton déconnexion, look "profile trigger" essig_front au lieu du `<button>` brut actuel.
- `Topbar.test.tsx` vérifie le comportement de déconnexion — ne doit pas casser.

### `app/Dashboard.tsx`
- `Carte` interne remplacée par le nouveau `Card` partagé (`components/ui/card.tsx`).
- Tokens de couleur (fond, ombre `--shadow`) appliqués via classes Tailwind utilisant les nouvelles variables.
- `Dashboard.test.tsx` vérifie les données affichées (chargement/erreur/valeurs) — ne doit pas casser.

### `components/Chip.tsx`
Remapper les 4 variantes (success/warning/error/info) sur les nouveaux tokens (`--primary`/teal pour success, `--warning`/amber, `--danger`, `--violet` ou bleu pour info) au lieu des classes Tailwind vert/jaune/rouge/bleu brutes.

## Hors scope (phase 2, spec séparée)

Pages/composants des modules personnes, paie, scolarité, trésorerie, résultats, évaluations, référentiel. Elles héritent automatiquement de la palette/du shell mais leurs propres cartes/tableaux/formulaires ne sont pas restylés dans cette phase.

## Tests

Aucun nouveau test comportemental requis (pas de nouvelle logique). Exécuter la suite existante (`vitest`) après chaque composant modifié ; corriger uniquement si une assertion est couplée à une classe CSS précise (peu probable d'après lecture des tests actuels, qui testent des textes/rôles/comportements).
