# PROMPT MAÎTRE — REFONTE UX/UI D'ESSIG_GEST

**React · TypeScript · Design System · Glassmorphism maîtrisé · Gestion scolaire · Mobile-first (mobile / tablette / PC)**

---

## 0. Comment utiliser ce prompt

Ce prompt est destiné à un agent de développement (Claude Code ou équivalent) qui a accès au dépôt ESSIG_GEST, à un terminal et aux fichiers de logos. Il est organisé en **phases séquentielles**. Chaque phase possède : un objectif, des tâches détaillées, des livrables et des **critères de sortie** (« gates »). L'agent ne passe à la phase suivante que si les critères de sortie de la phase en cours sont remplis ou si l'écart est documenté.

**Principe directeur transversal : le responsive n'est pas une phase finale.** Il est conçu *dès la Phase 2* (tokens, composants) et vérifié *à chaque phase* sur trois familles d'appareils : mobile, tablette, PC. Toute tâche ci-dessous doit être lue avec ce réflexe : « comment cela se comporte-t-il à 360 px, à 768 px et à 1280 px ? ».

---

## 1. Rôle et mission

Agis comme :

- un **architecte frontend senior** (React, TypeScript, design systems),
- un **spécialiste UI/UX** des plateformes administratives et étudiantes,
- un **ingénieur en accessibilité** (WCAG 2.2 AA),
- un **ingénieur performance web** (appareils modestes, réseaux instables — contexte d'usage réaliste pour des utilisateurs sur smartphone d'entrée de gamme et connexion mobile variable).

**Mission** : auditer, concevoir et **implémenter** une refonte cohérente de l'interface d'ESSIG_GEST, plateforme de gestion scolaire du Groupe ESSIG.

Le résultat doit être une application **professionnelle, moderne, élégante, responsive, accessible, performante et réellement fonctionnelle**.

Il ne s'agit **pas** de créer une maquette, un prototype isolé ou une application parallèle. Tu améliores l'application existante en respectant son architecture, ses contrats API, ses règles métier, ses permissions, son authentification et ses composants réutilisables.

**Objectif prioritaire** : améliorer l'expérience réelle des utilisateurs — sur leur appareil réel — sans compromettre l'intégrité du système de gestion.

---

## 2. Règles impératives avant toute modification

### 2.1 Inspection du dépôt (obligatoire)

Inspecte et consigne :

1. Framework, versions de React / TypeScript, routeur, outil de build (Vite, CRA, Next, etc.), gestionnaire de paquets.
2. Structure des dossiers, organisation par modules/features, alias d'import, conventions de nommage.
3. Composants partagés, layouts, pages, système de navigation, guards de routes.
4. Bibliothèques UI, icônes, styles globaux, configuration Tailwind (ou autre), variables CSS, polices.
5. Hooks, contextes, stores, gestion des formulaires et validations.
6. Couche d'accès aux données : client HTTP, intercepteurs, gestion des tokens/sessions, cache (React Query, SWR, etc.), types métier.
7. Rôles, permissions, états d'authentification, redirections.
8. Composants de tableaux, calendriers, graphiques, dialogues, notifications/toasts.
9. Tests existants (unitaires, intégration, e2e), scripts `lint` / `typecheck` / `build` / `test`, erreurs connues, dette technique.
10. **Spécifique responsive** : meta viewport, breakpoints existants (Tailwind ou media queries éparses), usage de `100vh`, tailles fixes en `px`, `overflow` problématiques, tableaux non adaptés, menus non tactiles, hover-only interactions, tailles de police < 16 px sur champs (zoom iOS), éléments `position: fixed` susceptibles de masquer du contenu au clavier virtuel.

### 2.2 Réutilisation avant création

Identifie les composants déjà disponibles avant d'en créer. Respecte les conventions et les dépendances existantes. **N'ajoute pas une bibliothèque simplement parce qu'elle est populaire.** Toute nouvelle dépendance doit être justifiée par écrit (besoin, alternatives existantes écartées, poids gzip estimé, impact responsive/perf).

### 2.3 Sécurité du travail

- Travaille sur une **branche dédiée** (`refonte/ui-essig-gest`) avec des **commits atomiques par phase/composant** (format `feat(ui): …`, `refactor(ui): …`, `fix(a11y): …`).
- **Aucune** migration, modification de schéma, renommage de champ API, ni appel de mutation réelle (finance, notes, suppression) pendant le développement ou les tests visuels.
- Lance l'application avec des données de test/fixtures/mocks explicitement prévus. Si aucun environnement de test n'existe, **signale-le** et utilise des mocks isolés (MSW ou équivalent déjà présent), jamais la production.
- Prends une **baseline** avant toute modification : résultats de `typecheck`, `lint`, `test`, `build` et captures d'écran des écrans clés (mobile/tablette/PC) pour permettre les comparaisons avant/après.

### 2.4 Diagnostic avant implémentation

Avant d'implémenter, présente un **diagnostic synthétique** et un **plan d'exécution priorisé** (format du §16, Phase 1). Puis **réalise effectivement** les changements : ne t'arrête pas à la proposition théorique.

---

## 3. Identité visuelle officielle ESSIG

### 3.1 Logos de référence

- Logo du **Groupe ESSIG**.
- Logo horizontal **USIA–ESSIG**.
- Variante graphique **USIA–ESSIG**.

Inspecte les fichiers originaux (format, dimensions, transparence, marges internes, versions claire/sombre éventuelles). Ne les redessine pas, ne les déforme pas, ne leur applique pas de filtres qui altèrent l'identité (pas de `filter: brightness/invert` sur le logo couleur ; si une variante monochrome blanche est nécessaire sur fond sombre, demande-la ou utilise une variante officielle existante).

### 3.2 Usage responsive des logos

| Contexte | Variante | Règle |
|---|---|---|
| Sidebar PC (étendue) | Logo horizontal | Largeur max ≈ largeur de la sidebar − paddings ; hauteur ≥ 32 px |
| Sidebar PC (réduite, rail d'icônes) | Variante graphique / pictogramme | Carré net, pas de texte illisible |
| Tablette (rail ou tiroir) | Pictogramme dans la barre, horizontal dans le tiroir | — |
| Mobile (barre supérieure) | Pictogramme ou horizontal compact | Hauteur 28–32 px, jamais rogné |
| Écran de connexion | Logo principal centré | Hauteur 56–72 px mobile, 72–96 px PC |
| Favicon / PWA | Variante graphique | Générer les tailles nécessaires depuis l'original |

- Fournis `width`/`height` (ou `aspect-ratio`) pour éviter les décalages de layout (CLS).
- Privilégie SVG s'il est disponible ; sinon PNG avec `srcset` 1x/2x et compression sans perte visible.
- `alt` explicite (« ESSIG — Groupe » / « USIA–ESSIG ») ; `alt=""` si purement décoratif à côté d'un nom textuel.
- Zone de protection autour du logo (≥ 50 % de sa hauteur).

### 3.3 Palette (valeurs provisoires à vérifier)

Extrais les couleurs réelles des fichiers (ex. `sharp`, `node-vibrant`, ou échantillonnage) et compare avec :

| Rôle | Valeur provisoire |
|---|---|
| Bleu cyan institutionnel | `#079DD3` |
| Brun / ocre | `#AD701F` |
| Charbon | `#202322` |
| Blanc bleuté | `#F4F8FB` |
| Blanc | `#FFFFFF` |

Documente l'écart éventuel (valeur extraite vs valeur provisoire) et **retiens la valeur extraite si elle diffère notablement**.

### 3.4 Tokens sémantiques (variables CSS)

Crée (ou consolide) les tokens, déclinés **clair** et **sombre** si le thème sombre est compatible avec l'application :

```
--brand-primary  --brand-primary-hover  --brand-primary-active  --brand-primary-subtle  --brand-on-primary
--brand-accent   --brand-accent-subtle
--background  --background-elevated  --surface  --surface-glass  --surface-glass-border
--foreground  --muted-foreground
--border  --border-strong  --focus-ring
--success  --warning  --destructive  --info   (+ variantes -subtle et -foreground)
```

Règles :

- Aucun code hexadécimal en dur dans les composants : tout passe par les tokens (et le mapping Tailwind si utilisé).
- Le **cyan** porte la marque : actions primaires, liens, navigation active, focus, éléments importants. Le **brun** reste un accent parcimonieux (badges spéciaux, séparateurs, détails). Le **charbon** garantit la lisibilité du texte.
- Succès / avertissement / erreur restent **distincts** du code couleur institutionnel (le cyan ne signifie jamais « succès » ou « info » à lui seul).
- **Ne sacrifie jamais le contraste** pour garder la couleur exacte du logo : si `#079DD3` ne passe pas 4,5:1 comme texte sur fond clair, utilise une variante plus foncée (`--brand-primary-text`) pour les liens/textes, et garde la couleur exacte pour les aplats et le logo.
- **Valide les contrastes par script** (calcul WCAG) pour chaque paire texte/fond, y compris sur surfaces glass et en mode sombre. Consigne le tableau dans la doc du design system.

---

## 4. Direction artistique : glassmorphism maîtrisé

### 4.1 Principes

- Arrière-plans légèrement teintés de bleu, dégradés très subtils.
- Surfaces translucides **sélectives** : navigation, éléments flottants, panneaux secondaires.
- Bordures fines et discrètes ; ombres douces ; profondeur modérée.
- Rayons cohérents (échelle définie, sans exagération) ; hiérarchie typographique nette ; icônes homogènes ; animations courtes et fonctionnelles.

### 4.2 Où utiliser (et ne pas utiliser) le verre

| Utiliser (verre + flou + fallback) | Fond opaque obligatoire |
|---|---|
| Sidebar, topbar, tiroir mobile (en superposition) | Tableaux de notes, listes d'étudiants |
| Popovers, menus déroulants, tooltips | Formulaires financiers, bulletins |
| Panneaux secondaires/statistiques légers | Calendriers/emplois du temps denses |
| Barre d'actions flottante, bottom nav mobile | Dialogues de confirmation, saisie sensible |

### 4.3 Implémentation sûre

```css
.glass {
  background: var(--surface-glass-fallback);            /* opaque par défaut */
  border: 1px solid var(--surface-glass-border);
  box-shadow: var(--shadow-sm);
}
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .glass {
    background: var(--surface-glass);                   /* ≥ 80–90 % d'opacité */
    -webkit-backdrop-filter: blur(var(--blur-md)) saturate(1.1);
    backdrop-filter: blur(var(--blur-md)) saturate(1.1);
  }
}
@media (prefers-reduced-transparency: reduce) {
  .glass { background: var(--surface-glass-fallback); backdrop-filter: none; }
}
```

### 4.4 Règles de performance du verre (spécifiques mobile)

- **Mobile / appareils modestes** : flou réduit (`--blur-md` ≈ 8–12 px sur mobile contre 16–20 px sur PC), pas plus de **2 surfaces floutées simultanément visibles**, jamais de `backdrop-filter` sur des éléments qui défilent ou sont animés en continu, ni sur des listes répétées.
- Pas de `backdrop-filter` imbriqué. Éviter `will-change` permanent.
- Prévoir un **niveau de dégradation** : `@media (max-width: 767px)` et `(prefers-reduced-data)`/`(prefers-reduced-transparency)` → surfaces plus opaques.
- Mesurer sur un profil CPU ralenti (DevTools : 4× throttling) : aucune saccade perceptible au défilement et à l'ouverture du tiroir.

### 4.5 À éviter

Effets néon, halos cyan excessifs, textes gris trop pâles, dégradés omniprésents, animations décoratives permanentes, cartes donnant toutes l'impression d'être prioritaires. Cible : **logiciel institutionnel premium**, pas une landing page marketing.

---

## 5. Architecture du design system

Crée ou consolide un design system unique, documenté (fichier `docs/design-system.md` et/ou page interne `/design-system` protégée en dev).

### 5.1 Fondations à définir

1. **Couleurs sémantiques** (§3.4).
2. **Typographie** : famille (conserver l'existante si cohérente ; sinon une police sans-serif lisible, auto-hébergée, `font-display: swap`, sous-ensemble latin + accents français), échelle **fluide** avec `clamp()` :
   - corps : 16 px minimum (14 px autorisé pour données denses sur PC uniquement) ; **champs de saisie ≥ 16 px sur mobile** (évite le zoom automatique iOS),
   - titres : `clamp(1.25rem, 1.1rem + 0.8vw, 1.75rem)` etc., interlignage 1,4–1,6, longueur de ligne ≤ 75 caractères pour les textes longs.
3. **Espacements** : échelle basée sur 4 px ; marges de page responsive (16 px mobile, 24 px tablette, 32 px PC).
4. **Rayons** : `sm / md / lg / xl / full` ; usage documenté (champs `md`, cartes `lg`, bottom sheets `xl` en haut).
5. **Ombres / élévations** : 4 niveaux maximum.
6. **Icônes** : une seule bibliothèque (Lucide si déjà cohérent avec le dépôt) ; tailles 16 / 20 / 24 ; trait homogène ; `aria-hidden` si décoratives.
7. **Hauteurs de contrôles** : boutons/champs 40 px (PC) et **≥ 44 px sur pointeur grossier** (`@media (pointer: coarse)`), zone tactile minimale 44×44 px (WCAG 2.2 : 24×24 px minimum, 44 recommandé), espacement ≥ 8 px entre cibles adjacentes.
8. **Transitions** : 120–200 ms, `ease-out`, désactivées/réduites avec `prefers-reduced-motion`.
9. **États interactifs** : default, hover (jamais seul porteur d'information), focus-visible, active, disabled, loading, error, selected.
10. **Conventions formulaires et tableaux** (§9 et §10).
11. **États de chargement / erreur / vide** (squelettes dont les dimensions réservent la place du contenu final).

### 5.2 Système de breakpoints (mobile-first)

Conserve les breakpoints Tailwind par défaut si le projet l'utilise ; sinon définis-les en tokens :

| Famille | Plage | Breakpoint | Comportement de layout |
|---|---|---|---|
| Mobile compact | 320–479 px | base | 1 colonne, tiroir de navigation + (optionnel) barre d'onglets basse |
| Mobile large / paysage | 480–767 px | `sm` (640) | 1–2 colonnes de cartes, formulaires 1 colonne |
| Tablette portrait | 768–1023 px | `md` (768) | Rail de navigation réduit ou tiroir, grilles 2 colonnes, formulaires 1–2 colonnes |
| Tablette paysage / petit portable | 1024–1279 px | `lg` (1024) | Sidebar fixe (réduite par défaut selon préférence), grilles 3 colonnes |
| PC | 1280–1535 px | `xl` (1280) | Sidebar étendue, grilles 3–4 colonnes, panneaux latéraux |
| Grand écran | ≥ 1536 px | `2xl` | Largeur de contenu bornée (≈ 1440 px) centrée ; pas d'étirement infini |

Règles :

- **Mobile-first** : styles de base = mobile ; on enrichit avec `min-width`.
- Utilise des **container queries** (`@container`) pour les composants qui changent selon l'espace disponible (StatCard, cartes de cours, panneaux) et non selon la fenêtre, quand le navigateur cible le permet.
- Détecte le **type de pointeur** (`pointer: coarse` / `hover: none`) pour adapter les tailles de cibles et supprimer les interactions « hover only ».
- `100dvh` / `100svh` au lieu de `100vh` ; gérer `env(safe-area-inset-*)` pour les barres fixes (encoches iOS).
- Aucune largeur fixe en `px` supérieure à la fenêtre ; `min-width: 0` sur les enfants de flex/grid pour éviter les débordements ; `overflow-wrap: anywhere` sur les textes longs (emails, noms).
- **Aucun défilement horizontal de page** à partir de 320 px (hors conteneurs de tableau explicitement scrollables).

### 5.3 Composants (à harmoniser ou créer selon l'existant)

`AppShell`, `AppSidebar`, `AppHeader`, `MobileNavDrawer`, `BottomNav` (si pertinent), `PageHeader`, `Breadcrumbs`, `StatCard`, `DataTable`, `DataTableToolbar`, `ResponsiveTable` (variante table → cartes), `SearchInput`, `FilterBar` (+ `FilterSheet` mobile), `StatusBadge`, `FormField`, `FormSection`, `StickyFormActions`, `ConfirmDialog`, `EmptyState`, `LoadingState`, `Skeleton`, `ErrorState`, `NotificationCenter`, `UserAvatar`, `ResponsiveDialog` (dialogue sur PC, **bottom sheet** sur mobile), `Pagination` (version compacte mobile), `AccessibleTooltip`, `ResponsiveTabs`, `SegmentedControl`, `ScheduleView`.

Chaque composant doit avoir : une responsabilité claire, des props typées (pas de `any`), des états cohérents, un **comportement responsive documenté** (tableau « mobile / tablette / PC »), et idéalement une entrée dans la page de démonstration du design system (mock data).

---

## 6. Stack technique

Conserve **en priorité la stack existante**. Si React + TypeScript + Tailwind sont déjà là, exploite-les sans reconstruire arbitrairement le système de styles.

Pour les composants manquants, évalue selon le dépôt (et **uniquement si absents**) :

- shadcn/ui (primitives et compositions) ;
- Radix UI ou React Aria (selon l'existant) pour les interactions accessibles ;
- Lucide React pour les icônes ;
- TanStack Table pour les tableaux complexes ;
- Recharts pour les graphiques (chargés en lazy sur les pages qui en ont besoin) ;
- React Hook Form + Zod, uniquement si cohérent avec l'architecture actuelle.

Pour le responsive en particulier : `vaul` (ou équivalent déjà présent) pour les bottom sheets **seulement si** la primitive Dialog existante ne suffit pas ; préfère CSS pur + attributs de données avant d'ajouter du JS.

Interdits : seconde bibliothèque pour un besoin déjà couvert ; remplacement du routeur/store/système de formulaires sans justification technique documentée.

---

## 7. Layout général (responsive par conception)

### 7.1 `AppShell` : comportement par famille d'écran

| Élément | Mobile (< 768) | Tablette (768–1023) | PC (≥ 1024) |
|---|---|---|---|
| Navigation | **Tiroir** plein-hauteur ouvert par bouton ☰ ; fermeture : bouton explicite, `Esc`, balayage, clic sur voile, changement de route | **Rail d'icônes** (≈ 72 px) ou tiroir ; libellés au survol/focus ou au toucher long | **Sidebar** fixe étendue (≈ 264 px) ou réduite (≈ 72 px), état mémorisé (préférence utilisateur) |
| Barre supérieure | Hauteur 56 px : ☰, logo compact, notifications, avatar ; titre de page dans le contenu | Hauteur 60 px : ☰/rail, titre, recherche (icône → champ), notifications, profil | Hauteur 64 px : fil d'Ariane, titre, recherche, notifications, profil, actions contextuelles |
| Contenu | Marges 16 px, 1 colonne | Marges 24 px, 2 colonnes | Marges 32 px, jusqu'à 3–4 colonnes, largeur bornée |
| Actions principales | Bouton principal pleine largeur ou **FAB/barre d'action collante en bas** (avec marge safe-area) | Dans l'en-tête de page | Dans l'en-tête de page, alignées à droite |

Détails d'implémentation :

- Le tiroir mobile est un **dialogue modal accessible** : `role="dialog"`/`aria-modal`, piège de focus, retour du focus au déclencheur, verrouillage du défilement du `body` (sans saut de layout), `inert` sur le contenu en arrière-plan.
- Navigation **regroupée par domaine métier** (ex. Pilotage, Pédagogie, Étudiants, Communication, Administration — à adapter au modèle réel), avec sous-menus repliables ; état actif visible par **couleur + indicateur (barre/icône/gras)**, `aria-current="page"`.
- Bas de navigation : bloc session (avatar, nom, rôle) → profil, préférences, déconnexion. Sur mobile, ce bloc est en pied de tiroir.
- Si une `BottomNav` est retenue (5 entrées max, pour étudiants/enseignants dont l'usage est surtout mobile), elle remplace les accès fréquents, **ne remplace pas** le tiroir complet, et respecte `safe-area-inset-bottom`.
- **Le layout ne se reconstruit pas** entre routes d'un même espace : `AppShell` au niveau du routeur parent, `Outlet` pour le contenu ; focus géré au changement de route (focus sur `<h1>` ou conteneur principal + annonce du titre).
- Lien d'évitement « Aller au contenu principal » en premier élément focusable ; landmarks `header`, `nav`, `main`, `aside`.

### 7.2 Barre supérieure

- Bouton d'ouverture/réduction de navigation (nom accessible, `aria-expanded`, `aria-controls`).
- Fil d'Ariane **uniquement lorsque pertinent** (3 niveaux et plus) ; sur mobile, il se réduit au **lien « Retour »** vers le parent (+ titre).
- Recherche globale **uniquement si réellement fonctionnelle** (branchée sur un endpoint existant ; sinon ne pas l'afficher). Mobile : icône → panneau plein écran.
- Notifications (compteur annoncé aux lecteurs d'écran, panneau en bottom sheet sur mobile / popover sur PC).
- Profil utilisateur (menu : profil, préférences, déconnexion).
- Actions contextuelles limitées et utiles ; regroupées dans un menu « Actions » (`…`) sur mobile.

### 7.3 Zone principale

- Largeur et espacements maîtrisés ; `PageHeader` : titre (`h1` unique), description, actions ; sur mobile, actions secondaires dans un menu.
- Filtres regroupés (`FilterBar`) ; cartes et tableaux alignés sur une même grille.
- Gestion explicite du débordement horizontal (§9.4).
- États de chargement (squelettes stables), erreurs récupérables (bouton « Réessayer »), états vides explicatifs avec action pertinente (si autorisée).

---

## 8. Expériences distinctes selon les rôles

**Inspecte d'abord les rôles et permissions réels** (backend, tokens, guards, enums). Ne suppose l'existence d'aucun rôle ou permission non présent.

Pour chaque rôle, produis une **matrice** : rôle → routes accessibles → actions autorisées → données visibles. La navigation et les écrans sont dérivés de cette matrice (et non d'un dashboard universel).

> Rappel : masquer une action dans React n'est **pas** une protection. Les contrôles d'accès restent appliqués par le backend ; le frontend gère proprement les `401/403` (redirection, message clair, pas de page blanche).

### Priorité d'appareil par profil (guide de conception)

| Profil | Appareil dominant probable | Conséquence de conception |
|---|---|---|
| Étudiant | **Smartphone** | Mobile-first strict, `BottomNav`, cartes, lecture rapide, faible bande passante |
| Enseignant | Smartphone + PC | Saisie de notes optimisée tactile **et** clavier ; vue « mes cours du jour » mobile |
| Administration pédagogique | PC + tablette | Tableaux denses, filtres puissants, vues planning étendues |
| Administration générale | PC | Indicateurs, rapports, tableaux ; consultation correcte sur tablette/mobile |

*(À confirmer/ajuster selon l'audit et les statistiques d'usage disponibles ; ne pas inventer de chiffres.)*

### A. Administration générale
Indicateurs institutionnels, effectifs et inscriptions, activités récentes, alertes, suivi des dossiers, accès aux modules autorisés, rapports et graphiques utiles, éléments nécessitant une intervention — **calculés à partir de données réelles et contextualisés** (période, périmètre).
- *Mobile* : KPI empilés (1 colonne, les 2–4 plus critiques en premier), graphiques simplifiés (sparklines, barres horizontales), « À traiter » en tête. *Tablette* : 2 colonnes. *PC* : grille 3–4 colonnes + panneau d'activité latéral.

### B. Administration pédagogique
Classes et groupes pédagogiques **réellement présents dans le modèle**, étudiants, emplois du temps, évaluations, notes selon droits, bulletins et résultats, actualités et communications.

### C. Enseignants
Emplois du temps, classes/cours attribués, listes d'étudiants autorisées, saisie des évaluations, notes et commentaires, tâches à effectuer, communications pertinentes.
- *Mobile* : « Aujourd'hui » (prochain cours, tâches en attente) en première vue ; saisie de notes en **liste d'étudiants une-par-une** avec champ numérique (`inputmode="decimal"`) et navigation suivante/précédente.

### D. Étudiants
Tableau de bord personnel, emploi du temps, notes et résultats **publiés**, bulletins selon règles métier, actualités, profil, historique autorisé, notifications et échéances.
- Expérience **plus simple**, orientée mobile ; **jamais** d'outils de gestion interne visibles ni accessibles côté UI (et vérifiés côté API).

### E. Autres profils
Uniquement ceux découverts à l'audit.

---

## 9. Modules métier et composants spécialisés (responsive détaillé)

### 9.1 Emplois du temps (`ScheduleView`)

- **Vues** : *Jour*, *Semaine*, *Mois* (si utile) + *Agenda/Liste*.
- **Mobile** : vue **Jour** ou **Agenda** (liste chronologique groupée par jour) par défaut ; sélecteur de jour en bande horizontale défilable (7 jours) ; navigation précédent/suivant + « Aujourd'hui » ; la vue Semaine en grille complète n'est **pas** forcée à 360 px (si proposée : défilement horizontal avec colonne des heures collante, ou vue 3 jours).
- **Tablette** : Semaine compacte (5–6 jours), Jour détaillé en panneau.
- **PC** : Semaine complète, Mois, panneau de détail latéral, filtres persistants.
- Filtrage par classe, enseignant, salle ou autre critère **autorisé par le rôle**.
- Carte de cours : heure, matière, intervenant, lieu (si données existantes) ; distinction par couleur **+ libellé/icône** (jamais couleur seule) ; troncature maîtrisée (`line-clamp`) avec détail au toucher/clic (bottom sheet mobile / popover PC).
- Chevauchements et conflits détectés par les données : signalés visuellement et textuellement (« Conflit avec … »), **sans corriger ni inventer**.
- États : aucun cours, période non renseignée, erreur de chargement. **Ne simule aucune disponibilité inexistante.**
- Fuseau et formats de date/heure cohérents (locale `fr`), semaine commençant le lundi (vérifier la règle existante).
- Accessibilité : grille navigable au clavier, rôles ARIA appropriés ou liste sémantique alternative ; annonce du changement de période.

### 9.2 Notes et résultats

- Tableau lisible et filtrable (classe, matière, période, statut).
- Statuts **réellement définis** (brouillon, en attente, publié…) via `StatusBadge` (couleur + icône + texte).
- Moyennes et pondérations selon les règles métier existantes ; **ne modifie jamais les calculs**.
- Évaluations non renseignées : marqueur explicite (« Non saisie »), jamais « 0 » implicite.
- Publication : `ConfirmDialog` contextualisé (nombre d'étudiants/évaluations concernés) ; règles backend inchangées.
- **Mobile — saisie** : mode « fiche par étudiant » ou liste avec champ de note large ; clavier numérique ; sauvegarde claire ; barre d'action collante (« Enregistrer le brouillon » / « Soumettre »). **Mobile — consultation** : liste de cartes (matière, note, coefficient, moyenne) avec détail en bottom sheet.
- **PC/tablette** : vraie `<table>` accessible, en-têtes collants, première colonne (nom) collante, tri, saisie au clavier (Tab / Entrée / flèches), indicateur de modifications non enregistrées.
- Historique/traçabilité affiché uniquement si le backend l'expose.

### 9.3 Actualités et communications

- Liste chronologique, priorité (badge + libellé), date de publication, catégories si existantes.
- Lecture détaillée : page dédiée sur mobile, panneau/lecture en colonne sur PC.
- Lu/non lu **uniquement** si supporté par le système.
- Pièces jointes : lien avec nom, type, taille ; accès contrôlé (liens signés/authentifiés) ; téléchargement fiable sur mobile.
- Distinction information importante / ordinaire (pas uniquement par la couleur).

### 9.4 Tableaux de données — stratégie responsive

Choisis la stratégie **selon la nature des données**, pas par réflexe :

| Cas | Stratégie mobile | Stratégie tablette | Stratégie PC |
|---|---|---|---|
| Données **denses à comparer** (notes, effectifs, finances) | Vraie table dans un conteneur `overflow-x: auto` avec **colonne d'identité collante**, ombre de défilement, indicateur « glisser » ; ou vue détail par ligne | Table avec colonnes secondaires masquables | Table complète, colonnes configurables, en-têtes collants |
| Listes d'entités (étudiants, utilisateurs, actualités) | **Cartes** (identité, 2–3 champs clés, statut, menu d'actions) | Table réduite ou cartes en 2 colonnes | Table complète |
| Données de référence simples | Liste à une colonne | Table | Table |

Exigences communes :

- Tri, recherche, filtres, pagination (version compacte mobile : précédent/suivant + « page X sur Y »), sélection de lignes si nécessaire, actions contextuelles (menu `…` avec cible ≥ 44 px), gestion des colonnes (PC/tablette), nombre de résultats (`aria-live="polite"` à la mise à jour), états vide/erreur/chargement.
- Filtres : `FilterBar` visible sur PC ; **bouton « Filtres (n) » → bottom sheet** sur mobile avec « Appliquer / Réinitialiser » ; filtres actifs rappelés sous forme de pastilles supprimables.
- Conservation raisonnable des filtres/tri/page dans l'URL (`searchParams`) pour retour arrière et partage.
- `<table>` sémantique : `caption` (ou `aria-label`), `th scope`, `aria-sort`. Pas de `div` imitant un tableau pour les données denses.
- Listes longues : pagination côté serveur si l'API le permet ; virtualisation **seulement** si mesure justifiée.

### 9.5 Profils et utilisateurs

Avatar/initiales (contraste vérifié), identité et rôle, coordonnées autorisées, informations scolaires, formulaires éditables selon permissions, validation, confirmation des changements sensibles, messages de succès/erreur explicites. *Mobile* : sections en accordéon ou onglets défilables ; *PC* : deux colonnes (identité à gauche, formulaires à droite).

### 9.6 Authentification

Écran de connexion centré, **carte opaque** (pas de verre sur les champs), logo adapté, champs ≥ 44 px, `autocomplete` (`username`, `current-password`), affichage/masquage du mot de passe, message d'erreur lié aux champs (`aria-describedby`), prévention de double soumission, clavier virtuel qui ne masque pas le bouton (défilement/`scroll-padding`, pas de hauteur figée en `vh`). Ne touche ni à la logique de session ni au stockage des tokens.

---

## 10. Formulaires et actions sensibles

Uniformise tous les formulaires via `FormField` / `FormSection` :

- Libellés **toujours visibles** (pas de placeholder-only), indication des champs obligatoires (texte « obligatoire » ou `*` expliqué), aide contextuelle, validation de format, messages d'erreur compréhensibles liés par `aria-describedby`, `aria-invalid`.
- Conservation des données saisies en cas d'erreur lorsque c'est sûr ; indication de soumission en cours ; **prévention des doubles soumissions** (bouton désactivé + garde logique) ; retour visuel et annoncé (`role="status"`/`alert`).
- **Responsive des formulaires** :
  - Mobile : **1 colonne**, champs pleine largeur, `type`/`inputmode`/`autocomplete`/`enterkeyhint` adaptés (email, tel, numérique, date), taille de police ≥ 16 px, sélecteurs natifs privilégiés pour les listes courtes, actions primaire/secondaire **empilées** (primaire en haut ou barre collante en bas avec marge safe-area), `scroll-margin` pour que le champ en erreur ne soit pas masqué par la barre collante.
  - Tablette : 1–2 colonnes selon la densité.
  - PC : grille 2 colonnes pour les champs courts, sections visuellement séparées, actions alignées à droite.
  - Les formulaires longs sont découpés (sections/étapes) avec progression visible et sauvegarde de brouillon **uniquement si** le système le permet.
- Opérations destructrices/irréversibles : `ConfirmDialog` contextualisé (nomme l'objet concerné, conséquence, libellés de boutons explicites, focus initial sur l'action sûre). Sur mobile : bottom sheet ou dialogue centré court.
- **Ne change pas** les validations, permissions ou mécanismes de confirmation du backend. Une animation ou un changement de couleur n'est jamais une validation métier.
- **Ne déclenche aucune** mutation financière, validation de salaire, suppression définitive ou publication de notes pendant une démonstration ou un test visuel ; utilise fixtures/mocks.

---

## 11. Accessibilité (WCAG 2.2 AA)

Vérifie notamment :

- Contrastes (texte ≥ 4,5:1 ; texte large et composants UI ≥ 3:1), y compris sur surfaces glass et thème sombre.
- Navigation intégrale au clavier ; ordre de tabulation logique ; **focus visible** (anneau `--focus-ring` ≥ 2 px, contraste ≥ 3:1, non masqué par barres collantes — critère 2.4.11).
- Noms accessibles des boutons-icônes ; labels reliés aux champs ; erreurs reliées aux champs (3.3.1, 3.3.3) ; aide cohérente (3.2.6) ; saisie redondante évitée (3.3.7) ; authentification accessible (3.3.8).
- Dialogues/tiroirs/bottom sheets : focus piégé et restitué, `Esc`, titre accessible.
- Notifications annoncées (`aria-live`) ; statuts jamais indiqués par la couleur seule.
- **Cibles tactiles ≥ 24×24 px (2.5.8), 44×44 px visés** ; alternatives aux gestes complexes (balayage → bouton ; glisser → boutons) (2.5.1, 2.5.7).
- **Reflow (1.4.10)** : aucun défilement à deux dimensions à 320 px CSS de large / zoom 400 % (hors tableaux, calendriers, cartes où le contenu 2D est essentiel — avec alternative lisible si possible).
- Espacement du texte (1.4.12) et redimensionnement jusqu'à 200 % sans perte de contenu ; unités relatives (`rem`) ; pas de blocage du zoom (`user-scalable=no` interdit).
- Orientation : pas de verrouillage portrait/paysage (1.3.4).
- `prefers-reduced-motion`, `prefers-contrast`, `forced-colors` (mode contraste élevé Windows : bordures et focus restent visibles), `prefers-reduced-transparency`.
- `lang="fr"` ; titres de page (`document.title`) mis à jour à chaque route ; hiérarchie de titres cohérente.
- Outils : `eslint-plugin-jsx-a11y`, `axe-core`/`@axe-core/playwright` (si ajoutable ou déjà présent), test manuel clavier, vérification lecteur d'écran sur les parcours clés (NVDA/VoiceOver si possible, sinon le documenter comme non testé).

---

## 12. Responsive design — exigences détaillées

### 12.1 Matrice d'appareils de test (viewports minimaux)

| Famille | Viewports (L×H CSS) | Notes |
|---|---|---|
| Mobile compact | 320×568, **360×640**, 375×667 | 320 = pire cas ; 360 = Android courant |
| Mobile moderne | 390×844, 412×915 | Encoche/barres système, `dvh` |
| Mobile paysage | 667×375, 844×390 | Hauteur très réduite : barres collantes ne doivent pas occuper > 25 % |
| Tablette portrait | **768×1024**, 820×1180 | Rail vs tiroir |
| Tablette paysage | 1024×768, 1180×820 | Sidebar fixe |
| Portable | **1366×768**, 1440×900 | Hauteur limitée → pas de dépendance à de grandes hauteurs |
| Bureau | **1920×1080**, 2560×1440 | Largeur bornée, pas d'étirement |

Ajoute : zoom 200 % et 400 %, texte agrandi (taille de police navigateur 150 %), mode sombre si supporté, `prefers-reduced-motion`, `pointer: coarse` (émulation tactile).

### 12.2 Règles par type d'élément

- **Navigation** : cf. §7.1.
- **Cartes de statistiques** : grille auto (`repeat(auto-fit, minmax(min(100%, 240px), 1fr))`) ; empilées à < 640 px ; valeur lisible (taille `clamp`), libellé court, variation avec texte + icône.
- **Graphiques** : conteneur à ratio flexible, légendes sous le graphique sur mobile, étiquettes réduites/rotation évitées (préférer barres horizontales), tooltips au toucher, **alternative tabulaire accessible** (tableau masqué visuellement ou bouton « Voir les données ») ; chargement différé.
- **Actions** : primaire clairement identifiable ; sur mobile, actions secondaires dans un menu ; pas plus de 2 boutons visibles côte à côte.
- **Dialogues** : jamais plus grands que `calc(100dvh - 2rem)` ; contenu défilable, en-tête et pied collants ; mobile = bottom sheet (poignée visible, fermeture explicite, pas uniquement par balayage).
- **Calendriers et notes** : lisibilité préservée (§9.1, §9.2).
- **Médias** : images/logos avec dimensions réservées, `max-width: 100%`, `loading="lazy"` hors écran initial.
- **Texte** : pas de troncature qui masque une information critique ; tooltips non requis pour comprendre (pas d'info uniquement au survol).
- **Clavier virtuel** : champs focalisés restent visibles ; barres collantes basses se masquent ou se repositionnent quand le clavier est ouvert (`visualViewport` si nécessaire).
- **Pull-to-refresh / gestes natifs** : ne pas les casser ; `overscroll-behavior` maîtrisé dans les tiroirs et sheets.
- **Hors-ligne / réseau lent** : états de chargement stables, messages d'erreur réseau clairs, pas de perte silencieuse de saisie.

> Une page n'est **pas** responsive parce que sa largeur diminue : teste les **interactions** (touch, menus, formulaires, états de navigation, orientation, clavier virtuel).

---

## 13. Architecture React et qualité du code

- Composants réutilisables, responsabilités explicites ; séparation présentation / logique métier / accès aux données.
- Types TypeScript alignés sur les contrats existants ; **pas de `any`** ; pas d'assertions `as` pour masquer des erreurs.
- Hooks conformes aux règles de React ; pas d'états redondants ni de données dérivées stockées ; peu d'effets, avec nettoyage des écouteurs/abonnements.
- **Hooks responsive réutilisables** : `useMediaQuery`/`useBreakpoint` (basé sur `matchMedia`, SSR-safe, sans `resize` brut ni re-render excessif), `useIsCoarsePointer`, `usePrefersReducedMotion`. Préfère CSS aux hooks JS quand c'est suffisant (moins de re-rendus, pas de flash au premier rendu).
- Pas de composants monolithiques ; pas de dépendances circulaires ; tokens centralisés.
- Préserve la gestion des erreurs réseau et les conventions de cache/invalidation existantes.
- Aucun jeu de données statique inventé dans les écrans de production ; mocks uniquement dans tests/design-system/fixtures.
- Internationalisation : conserve le système existant ; textes en français cohérents (vocabulaire métier, pas de mélange), prévoir l'allongement des libellés (+30 %) dans les composants contraints.

---

## 14. Performance (mobile d'abord)

Surveille : poids des dépendances, rendus inutiles, listes longues, calculs coûteux, images/logos, flou et ombres, CLS, graphiques/calendriers, requêtes inutiles.

Objectifs indicatifs à mesurer (Lighthouse mobile émulé / DevTools, **à reporter avec les valeurs réellement mesurées**) :

- LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 sur les routes principales en profil « Mobile moyen / 4G lente ».
- Budget JS initial : comparer à la baseline ; **ne pas l'aggraver sans justification** ; découpage par route (`lazy`/`Suspense`) pour modules lourds (calendrier, graphiques).
- Polices : sous-ensemble, `preload` de la police principale, `font-display: swap`, pas plus de 2 familles / 4 graisses.
- Images : formats modernes si pipeline existant, dimensions explicites, `srcset`.
- Animations : uniquement `transform`/`opacity` ; durée courte ; désactivées en `prefers-reduced-motion`.

N'applique virtualisation, lazy loading ou mémoïsation **que** si un besoin est mesuré. Le glassmorphism ne doit provoquer aucun ralentissement perceptible sur appareil modeste (§4.4).

---

## 15. Contraintes métier non négociables

- Une école est une école. **Pas** de hiérarchie artificielle « pôle → groupe scolaire → école ». Retire des interfaces et de la navigation les notions obsolètes de « pôle » et de « groupe scolaire » lorsqu'elles ne correspondent pas au modèle retenu (libellés, filtres, breadcrumbs, routes d'affichage, types d'UI) **sans supprimer de données ni de tables** : si le backend les expose encore, signale-le comme point backend séparé.
- Conserve les entités réelles (écoles, structures pédagogiques effectivement présentes).
- Ne pas renommer des champs API ni modifier des migrations pour la cohérence visuelle.
- Ne pas inventer de rôles, statuts, chiffres, notes, actualités.
- Ne pas altérer règles de calcul, autorisations, workflows.
- Préserver l'intégrité des données et la traçabilité des opérations sensibles.
- Toute modification structurelle hors périmètre frontend est **identifiée, justifiée et traitée séparément** (ticket/note « À traiter côté backend »).

---

## 16. Méthode d'exécution — phases détaillées

Pour **chaque phase** : tâches → livrables → vérifications → critères de sortie. Commite à la fin de chaque sous-étape ; consigne les décisions dans `docs/refonte-ui/JOURNAL.md`.

### Phase 0 — Baseline et mise en place (≈ avant toute modification)

**Tâches**
1. Créer la branche ; installer les dépendances ; lancer `typecheck`, `lint`, `test`, `build` et noter les résultats **tels quels** (échecs préexistants inclus).
2. Lancer l'app avec données de test ; vérifier les comptes de test par rôle (sans créer de données de production).
3. Capturer des screenshots de référence (login, dashboard, 1 tableau, 1 formulaire, emploi du temps, notes) à **360×800, 768×1024, 1440×900**.
4. Mettre en place (si absent et si cohérent) un script de capture/test visuel (Playwright déjà présent ou ajout justifié en `devDependency`).

**Livrable** : `docs/refonte-ui/00-baseline.md` (commandes, résultats, captures).
**Sortie** : baseline reproductible et documentée.

### Phase 1 — Audit

**Tâches**
1. Cartographier routes, layouts, guards, par rôle (matrice rôles/routes/actions).
2. Inventorier composants communs, doublons, styles en dur (`grep` des hex, des `px` fixes, `100vh`, `w-[…px]`, `overflow`).
3. Relever les incohérences visuelles (couleurs, rayons, espacements, typographie, icônes).
4. **Audit responsive** : parcourir chaque écran clé sur la matrice §12.1 ; consigner débordements, cibles trop petites, menus inutilisables, tableaux cassés, hover-only, zoom iOS, clavier virtuel.
5. Audit accessibilité automatisé + manuel (clavier, focus, contrastes).
6. Vérifier permissions et contrats de données (types vs réponses API).
7. Identifier les risques de régression et les zones à forte valeur.
8. Repérer les occurrences de « pôle » / « groupe scolaire ».

**Livrable** : `docs/refonte-ui/01-audit.md` avec : diagnostic synthétique (top problèmes par gravité), tableau responsive (écran × viewport × problème), plan d'exécution **priorisé** (impact utilisateur × effort × risque), liste des dépendances envisagées et justifiées.
**Sortie** : diagnostic + plan présentés **avant** implémentation.

### Phase 2 — Fondation visuelle et responsive

**Tâches**
1. Extraire les couleurs des logos, valider/ajuster la palette (§3.3), calculer les contrastes.
2. Définir tokens (couleurs, typo fluide, espacements, rayons, ombres, blur, z-index, durées, tailles de cibles) pour clair/sombre.
3. Configurer breakpoints et utilitaires responsive (§5.2) ; ajouter les hooks (§13).
4. Styles globaux : reset raisonnable, `focus-visible`, `prefers-*`, `scroll-padding-top` (barres collantes), `-webkit-tap-highlight-color`, `touch-action` approprié, safe-area.
5. Construire les surfaces (`glass`, `surface`, `surface-solid`) avec fallbacks.
6. Harmoniser boutons, champs, sélecteurs, cases, cartes, badges, tableaux (base), dialogues, toasts — chacun avec ses états et son comportement responsive.
7. Page de démonstration du design system (mock data) testable aux 3 familles d'écran.

**Livrables** : tokens, composants de base, `docs/design-system.md`, tableau de contrastes.
**Sortie** : composants de base validés à 360/768/1280 px, contrastes AA vérifiés, `typecheck` + `lint` verts.

### Phase 3 — Layout global

**Tâches**
1. `AppShell` (routeur parent), `AppSidebar` (étendue/réduite), `MobileNavDrawer`, `AppHeader`, `Breadcrumbs`, menu profil, `NotificationCenter`, éventuelle `BottomNav`.
2. Navigation par rôle, groupes métier, état actif, sous-menus ; suppression des notions obsolètes.
3. Gestion du focus au changement de route, lien d'évitement, landmarks.
4. Persistance des préférences d'UI (sidebar réduite) via le mécanisme existant (`localStorage` avec try/catch) — uniquement préférences non sensibles.
5. Tests : navigation clavier complète ; ouverture/fermeture du tiroir (tactile émulé) ; transitions entre 767/768 et 1023/1024 px sans perte d'état.

**Sortie** : layout stable sur la matrice §12.1 ; aucun saut de layout au changement de route ; a11y du shell vérifiée.

### Phase 4 — Modules (ordre ajustable selon l'audit)

Pour **chaque module** : (a) liste des écrans, (b) refonte avec composants partagés, (c) vérification des appels API inchangés, (d) vérification des permissions, (e) vérification 3 familles d'écrans, (f) états chargement/erreur/vide, (g) tests ajoutés/adaptés, (h) commit.

Ordre indicatif :
1. Authentification et structure générale.
2. Dashboards par rôle et navigation.
3. Emplois du temps (§9.1).
4. Notes et résultats (§9.2).
5. Étudiants et profils (§9.5).
6. Actualités et notifications (§9.3).
7. Tableaux administratifs et autres modules.

**Définition de « module terminé »** : fonctionnalités identiques à l'avant, aucune régression de comportement, responsive validé (360 / 768 / 1280), clavier OK, axe sans violation critique/serious, états traités, pas de `any`, tests passants.

### Phase 5 — Vérification

**Tâches (exécuter réellement, ne rien déclarer sans exécution)**
1. `typecheck`, `lint`, `test`, `build` — comparer à la baseline.
2. Tests e2e/composants sur les parcours principaux, **par rôle**, avec projets Playwright mobile (`Pixel 5`/`iPhone` émulés), tablette (`iPad`), bureau.
3. Captures avant/après sur la matrice §12.1 pour les écrans clés ; détecter automatiquement le **débordement horizontal** (`document.documentElement.scrollWidth <= clientWidth`) à 320, 360, 768 px.
4. Tests de permissions : un étudiant ne voit ni n'atteint les routes de gestion (UI **et** réponses API 403 gérées).
5. États d'erreur : réseau coupé, 401, 403, 404, 500, liste vide.
6. Accessibilité : axe sur chaque page clé ; parcours clavier ; zoom 200/400 % ; `prefers-reduced-motion`.
7. Performance : Lighthouse mobile sur routes principales ; comparer taille des bundles à la baseline.
8. Corriger les régressions ; relancer jusqu'à stabilité.

**Livrable** : `docs/refonte-ui/05-verification.md` (commande → résultat réel → écarts → statut).
**Sortie** : toutes les vérifications exécutées et documentées ; échecs restants justifiés.

---

## 17. Critères de validation (la refonte est terminée uniquement si…)

- [ ] L'identité visuelle ESSIG est reconnaissable et cohérente ; logos officiels intégrés sans altération, adaptés à chaque contexte d'écran.
- [ ] Les composants réutilisables suivent un design system unique et documenté.
- [ ] Le glassmorphism reste discret, lisible, avec fallbacks, et sobre sur mobile.
- [ ] Les pages importantes sont **utilisables sur mobile (≥ 320 px), tablette et PC**, sans défilement horizontal de page.
- [ ] Les interactions tactiles (menus, tiroirs, sheets, formulaires, tableaux, calendriers) fonctionnent ; cibles ≥ 44 px visées.
- [ ] Les espaces utilisateur respectent les rôles et permissions réels (UI + gestion des refus backend).
- [ ] Emplois du temps, notes, profils et actualités restent connectés à leurs sources de données habituelles.
- [ ] Formulaires et tableaux fonctionnent réellement (validation, soumission, tri, filtres, pagination).
- [ ] États de chargement, d'erreur et vide traités partout.
- [ ] Parcours principaux utilisables au clavier et avec technologies d'assistance ; WCAG 2.2 AA visé, écarts documentés.
- [ ] Règles métier et opérations sensibles non contournées ; aucune mutation réelle déclenchée par les tests.
- [ ] Notions « pôle » / « groupe scolaire » retirées de l'interface lorsqu'obsolètes.
- [ ] Vérifications techniques exécutées, résultats réels documentés.

---

## 18. Livrable final attendu

1. Le diagnostic initial (y compris l'audit responsive).
2. Le résumé des choix UI/UX (et des choix responsive par famille d'écran).
3. Les fichiers créés et modifiés.
4. Les composants partagés introduits ou améliorés.
5. Les modules effectivement traités.
6. Les changements de dépendances, avec justification et poids.
7. Les tests et commandes exécutés, avec résultats réels (avant/après, baseline incluse).
8. Les problèmes restants et risques connus.
9. Les recommandations pour la prochaine phase.

Distingue clairement : **implémenté**, **testé**, **à faire**, **nécessite une intervention backend**. Ne marque jamais « testé » ce qui n'a pas été exécuté ; indique explicitement ce qui n'a pas pu être vérifié sur appareil réel (ex. iOS Safari, lecteur d'écran).

---

## 19. Instruction finale

Commence par analyser le dépôt réel d'ESSIG_GEST. N'invente pas son architecture. Préserve ses fonctionnalités et ses règles métier. Pense **mobile d'abord**, valide sur **tablette** et **PC**, puis implémente la refonte de manière progressive, cohérente et vérifiable — phase par phase, avec preuves à l'appui.