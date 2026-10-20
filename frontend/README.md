# ESSIG Gest — interface web

Frontend React du système de gestion scolaire **ESSIG Gest** (Django REST + MySQL dans
`../backend`). Interface entièrement en français, pensée mobile‑first puis desktop.

## Pile technique

| Domaine      | Choix                                             |
| ------------ | ------------------------------------------------- |
| UI           | React 19, React Router 7, Tailwind CSS 4 (`@theme`) |
| Données      | TanStack Query 5 (cache, invalidation ciblée)      |
| Langage      | TypeScript 7 (strict, `noUnusedLocals`)            |
| Build        | Vite 8                                             |
| Tests        | Vitest 5, jsdom, Testing Library                   |
| Icônes       | lucide-react                                       |

## Démarrage

```bash
npm install
npm run dev        # http://localhost:5173 (proxy /api → http://127.0.0.1:8000)
```

Variables (voir `.env.example`) :

- `VITE_API_BASE_URL` — vide par défaut : appels relatifs `/api/v1` (même origine, Vite/Caddy proxifie).
- `VITE_API_PROXY` — cible du proxy Vite en développement (non exposée au navigateur).
- `PORT` — port du serveur de dev/preview.

Scripts :

```bash
npm run dev        # serveur de développement
npm run typecheck  # tsc -b --noEmit
npm test           # vitest run
npm run build      # typecheck + build de production dans dist/
npm run preview    # sert dist/
```

## Architecture

```
src/
├── api/            # constantes d'endpoints par domaine (source unique des URL)
├── app/            # providers (QueryClient, Router, Toast, Auth), ErrorBoundary, pages 403/404
├── assets/         # logos importés et versionnés par le bundle
├── auth/           # AuthProvider (session JWT + refresh cookie) et miroir du RBAC
├── components/     # ui/ (Button, Dialog, DataTable…), layout/ (AppShell, PageHeader), data/
├── comptes/        # connexion, mon compte
├── evaluations/    # évaluations, saisie des notes
├── lib/            # http, hooks de requêtes, formats fr-FR, types API, queryClient
├── paie/           # enseignants, personnel, affectations, salaires, avances
├── personnes/      # étudiants, inscriptions, pièces de dossier
├── referentiel/    # écoles, années, niveaux, filières, options, modalités, classes, matières, périodes
├── resultats/      # délibérations, résultats annuels/période/matière
├── routes/         # navigation (RBAC) et gardes d'accès
├── scolarite/      # grille tarifaire, frais, bourses, échéancier
├── tableau-de-bord/# indicateurs consolidés
├── tresorerie/     # comptes, encaissements, dépenses, virements, arrêtés, journal
├── routes.tsx      # table de routage (lazy + Suspense)
└── main.tsx        # point d'entrée
```

### Conventions

- **Aucune couleur en dur** : uniquement les tokens de `index.css` (`--brand-*`, `--surface`,
  `--sidebar`, `--success`…), exposés aussi à Tailwind via `@theme`.
- **RBAC** : `auth/permissions.ts` reflète les permissions Django (`peutEcrire`,
  `peutLireFinances`, `possedeRole`). L'interface masque les actions interdites ; le serveur
  reste l'autorité finale.
- **Requêtes** : `lib/hooks.ts` fournit `usePagedList`, `useAll`, `useDetail`, `useCreate`,
  `useUpdate`, `useRemove`, `useAction`. Toute mutation invalide les listes du domaine et,
  pour les actions métier, le tableau de bord et les rapports.
- **Formulaires** : `ResourcePage` génère le CRUD complet d'une ressource (recherche,
  filtres, tri, pagination, dialogues, confirmation de suppression 409). Les écrans
  spécifiques (encaissements, notes, arrêtés) gardent la main sur leur mise en page.
- **Accessibilité** : navigation clavier, focus sur le titre à chaque changement de route,
  cibles ≥ 44 px, labels explicites, `aria-invalid` sur les erreurs, contraste AA.

## Sécurité de session

`lib/http.ts` conserve l'access token **en mémoire** (jamais dans `localStorage`), s'appuie
sur le cookie `refresh_token` httpOnly (`path=/api/v1/auth/`) et ne rejoue qu'une seule fois
une requête après rafraîchissement. Si le rafraîchissement échoue, l'événement
`essig:session-expiree` est émis et `AuthProvider` renvoie l'utilisateur vers la connexion.

## Tests

Les tests couvrent le formatage monétaire/dates, le tableau de données, la navigation
filtrée par rôle, la page de connexion et le tableau de bord (avec `api.get` simulé).
