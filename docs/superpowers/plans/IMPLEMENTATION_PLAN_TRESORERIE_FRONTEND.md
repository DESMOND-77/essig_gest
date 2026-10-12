# Plan d'implémentation mis à jour — Module Trésorerie

**Version :** 2.0 — plan consolidé après revue critique  
**Périmètre :** Frontend React/TypeScript et contrats/API backend Django REST Framework  
**Statut :** pret a implementer

---

## 0. Principes directeurs et règles de travail

Ce plan met à jour le plan initial en intégrant les corrections de routes, de validation, de sécurité, de cache, de services et d'organisation par entité verticale.

### 0.1 Règle préalable : vérifier le dépôt, ne rien supposer

Avant d'écrire du code, l'agent doit inspecter le dépôt et confirmer les éléments suivants :

- l'emplacement et la signature réels de `ResourcePage`, descripteurs, client API et composants de formulaire ;
- la version de Zod et les types de champs réellement pris en charge (`date`, `fk`, upload, champs calculés, etc.) ;
- les bibliothèques déjà installées pour l'état, le cache, les notifications et les graphiques ;
- les modèles, serializers, services, ViewSets, permissions, URLs, migrations et tests backend existants ;
- les endpoints réellement exposés, en les comparant aux URLs Django et au schéma OpenAPI ;
- les modèles et services de la Phase 4 déjà utilisés pour les inscriptions, échéances et imputations.

**Ne pas déclarer un audit, un modèle, un endpoint ou un test « déjà terminé » sans preuve dans le dépôt.** Ne pas créer de doublon de modèle, de service ou de bibliothèque si le projet possède déjà une solution.

### 0.2 Invariants non négociables

1. Le backend est l'autorité pour les droits, statuts, numéros de reçu, soldes, imputations FIFO, acteurs d'audit et calculs comptables.
2. Le frontend peut guider et prévalider la saisie, mais ne remplace jamais les contrôles métier backend.
3. Les mouvements comptabilisés sont consultables en lecture seule. Toute correction financière doit passer par une opération métier tracée (annulation, contrepassation ou ajustement autorisé), jamais par la modification arbitraire d'un mouvement posté.
4. Les opérations composées doivent être atomiques côté backend : encaissement + mouvement + imputations ; virement + deux mouvements ; paiement de dépense + mouvement ; billetage batch.
5. Les montants sont exprimés en FCFA en unités entières si le contrat métier le confirme. Le backend valide le type, les bornes et les invariants, indépendamment des validations TypeScript.
6. Les rôles et la séparation des fonctions doivent être vérifiés côté serveur. Masquer un bouton dans le frontend n'est pas une mesure d'autorisation suffisante.
7. Les routes, champs et exemples d'endpoints ci-dessous sont des contrats cibles à confirmer dans le dépôt/OpenAPI avant intégration ; ils ne doivent pas être considérés comme existants par défaut.

---

## 1. Structure cible des fichiers

Adapter cette structure aux conventions réellement présentes dans le dépôt. Éviter de dupliquer un service si le projet centralise déjà les appels API dans `frontend/src/lib/`.

```text
frontend/src/tresorerie/
├── components/
│   ├── EncaissementForm.tsx
│   ├── VirementForm.tsx
│   ├── DepenseForm.tsx
│   ├── ArreteCaisseForm.tsx
│   ├── BilletageForm.tsx
│   ├── TableauBord.tsx
│   └── actions/
│       ├── EncaissementActions.tsx
│       ├── VirementActions.tsx
│       ├── DepenseActions.tsx
│       └── ArreteCaisseActions.tsx
├── config/
│   ├── compte.tsx
│   ├── categorieMouvement.tsx
│   ├── virement.tsx
│   ├── mouvement.tsx
│   ├── encaissement.tsx
│   ├── imputationEncaissement.tsx
│   ├── depense.tsx
│   ├── arreteCaisse.tsx
│   └── billetage.tsx
├── lib/
│   ├── tresorerie.ts
│   ├── types.ts
│   └── erreurs.ts                 # uniquement si le projet n'a pas déjà un normaliseur partagé
├── routes.tsx
├── index.ts
└── types.ts                       # conserver un seul emplacement de types, éviter le doublon avec lib/types.ts
```

**Décision d'organisation :** si les services API du projet sont centralisés dans `frontend/src/lib/`, conserver `frontend/src/lib/tresorerie.ts` et ne pas créer une seconde implémentation sous `src/tresorerie/lib/`. Les types métier doivent avoir un emplacement unique.

---

## 2. Modèle d'interaction : CRUD standard vs actions métier

### 2.1 Ressources pouvant utiliser `ResourcePage`

Utiliser le composant générique uniquement pour les ressources dont les opérations sont réellement du CRUD ordinaire :

- **Comptes** : liste, consultation et modification des champs autorisés ; le solde courant est en lecture seule.
- **Catégories de mouvement** : liste et administration selon les permissions.
- **Mouvements** : consultation uniquement.
- **Imputations d'encaissement** : consultation uniquement ; aucune création/modification manuelle depuis un CRUD générique.

### 2.2 Ressources avec workflows spécialisés

Pour ces ressources, `ResourcePage` peut servir à la liste et à la consultation, mais ne doit pas permettre de modifier directement les statuts :

- **Encaissement** : créer, valider/comptabiliser si le workflow le prévoit, consulter le reçu, consulter les imputations, annuler selon les règles métier.
- **Virement** : créer/brouillon, engager, valider/exécuter, annuler selon le workflow confirmé.
- **Dépense** : engager, valider, payer, annuler selon les transitions autorisées.
- **Arrêté de caisse** : ouvrir/créer, enregistrer le comptage physique, enregistrer le billetage, soumettre/valider.
- **Billetage** : saisie en lot associée à un arrêté ; pas de création isolée si elle contourne le contrôle de cohérence de caisse.

Les actions doivent appeler des endpoints métier dédiés. Le formulaire de création ne doit pas accepter un statut arbitraire fourni par le navigateur.

### 2.3 Champs qui ne doivent pas être éditables par l'utilisateur

Retirer des formulaires de création/édition et calculer ou renseigner côté backend :

- `statut` pour encaissements, virements, dépenses et arrêtés de caisse ;
- `engage_par`, `valide_par`, `fait_par`, `cree_par`, `modifie_par` et champs d'audit équivalents ;
- `recu_numero` / numéro de reçu ;
- `solde_actuel`, `solde_theorique` et `ecart` lorsqu'ils sont calculés par le système ;
- `montant` de chaque ligne de billetage lorsqu'il vaut `denomination × quantite` ;
- toute donnée calculée issue du grand livre ou des imputations.

Ces champs peuvent être affichés dans les vues de détail en lecture seule.

---

## 3. Descripteurs et schémas de validation

Les descripteurs suivent le pattern du projet (configuration déclarative + Zod), après vérification de leur contrat exact.

### 3.1 Compte — `config/compte.tsx`

- Colonnes : code, libellé, type, banque, solde courant, actif.
- Champs éditables : groupe scolaire, code à la création, libellé, type, informations bancaires, actif.
- `solde_initial` : autorisé uniquement si le modèle métier le permet à la création ; ne pas le confondre avec le solde courant. Après initialisation, toute correction passe par une procédure d'ouverture/ajustement auditée.
- `soldeActuel` / solde calculé : lecture seule, alimenté par l'API.
- Autorisations UI indicatives : selon la matrice des rôles confirmée dans le backend. Les permissions backend restent obligatoires.

### 3.2 Catégorie de mouvement — `config/categorieMouvement.tsx`

- Champs : code, libellé, sens (`ENTREE`, `SORTIE`, `NEUTRE`) selon les choix réellement définis par le modèle.
- Les dépenses ne peuvent choisir que les catégories de sens `SORTIE`.
- Les catégories incompatibles avec des opérations financières existantes ne doivent pas être supprimées si cela brise l'historique ; préférer désactivation si le modèle le permet.

### 3.3 Virement — `config/virement.tsx`

- Colonnes : date, compte source, compte destination, montant, statut.
- Champs de saisie : compte source, compte destination, montant entier positif, date, motif.
- **Ne pas exposer `statut` dans le formulaire.**
- Validation frontend : source différente de destination ; montant strictement positif ; date valide.
- Contrôles backend : comptes autorisés/actifs, devise et périmètre compatibles, fonds suffisants si requis, absence de doublon idempotent, séparation des fonctions, transitions d'état.
- Le descripteur ne doit pas fournir un CRUD d'édition libre des virements déjà engagés/comptabilisés.

### 3.4 Mouvement — `config/mouvement.tsx`

- Lecture seule ; `roleEcriture: []` si c'est bien le contrat du descripteur.
- Colonnes : date d'opération, compte, sens, montant, catégorie, libellé, référence de pièce.
- Pas de formulaire d'ajout, d'édition ou de suppression.
- Les filtres doivent couvrir au minimum période et compte, et les autres filtres disponibles dans l'API.
- Le frontend ne doit jamais poster directement un mouvement comptabilisé.

### 3.5 Encaissement — `config/encaissement.tsx`

- Champs de saisie : inscription, date, montant total, mode de paiement, compte de crédit, référence de paiement si nécessaire.
- **Ne pas exposer `recu_numero` ni `statut` comme champs modifiables.**
- Le numéro de reçu est attribué côté serveur au moment de la création/comptabilisation atomique, avec contrainte d'unicité en base.
- Le statut doit être aligné sur la machine à états réelle. En particulier, décider explicitement si `A_IMPUTER` est un statut métier distinct ou si les imputations sont créées immédiatement. Ne pas conserver simultanément des enums contradictoires.
- La FIFO est une règle backend : le frontend affiche le résultat d'imputation retourné par l'API. Si une ventilation manuelle est autorisée par le métier, elle doit utiliser une action/API spécifique avec validation backend.
- Le reste dû affiché dans le formulaire est indicatif et doit être recalculé/contrôlé côté serveur au moment de l'opération.

### 3.6 Imputation d'encaissement — `config/imputationEncaissement.tsx`

- Lecture seule ; aucune action générique de création, modification ou suppression.
- Afficher reçu, cible, échéance/frais concernés, montant imputé et horodatage.
- L'invariant d'imputation est vérifié côté backend : somme imputée cohérente avec le montant encaissé et règles métier de surpaiement explicitement définies.

### 3.7 Dépense — `config/depense.tsx`

- Champs de saisie : date, catégorie de sortie, bénéficiaire, désignation, montant, compte de débit, école, année scolaire, justificatif.
- `annee_scolaire` : si le schéma Zod la rend obligatoire, le descripteur doit porter `requis: true`. **Choisir une seule règle cohérente** : obligatoire dans les deux couches, ou optionnelle dans les deux couches selon la règle métier confirmée.
- `engage_par`, `valide_par`, `statut` : absents du formulaire d'édition ; générés/transitionnés par les actions backend.
- Ne pas envoyer `engage_par`, `valide_par` ni `statut` dans le payload de création.
- Le téléversement de justificatif doit respecter le mécanisme de fichiers déjà utilisé dans le projet (multipart, stockage et contrôle de type/taille).
- Workflow cible à confirmer : `ENGAGEE → VALIDEE → PAYEE`, avec une transition d'annulation autorisée uniquement dans les états définis par le backend.

### 3.8 Arrêté de caisse — `config/arreteCaisse.tsx`

- Champs de saisie : compte de type caisse, date, solde physique/compté, billetage et observations éventuelles.
- `solde_theorique` est récupéré du backend et affiché en lecture seule ; il ne doit pas être saisi librement.
- `ecart = solde_physique - solde_theorique` est calculé par le backend et affiché comme résultat.
- `fait_par`, `valide_par`, `statut` : affichage lecture seule, non inclus dans le payload de création.
- Supprimer le `refine` redondant qui vérifie que deux champs déjà définis comme nombres obligatoires ne sont pas `null`.
- Contrôles backend : compte de type `CAISSE`, unicité compte/date si prévue, calcul de solde à la date de clôture, traçabilité de l'écart et validation séparée si exigée.

### 3.9 Billetage — `config/billetage.tsx`

- Le formulaire est un tableau dynamique de lignes : dénomination + quantité.
- `montant` n'est pas un champ de saisie ni une propriété obligatoire du schéma frontend d'entrée. Il est calculé côté backend comme `denomination × quantite`.
- Chaque ligne valide : dénomination entière strictement positive, quantité entière supérieure ou égale à zéro.
- Le total est calculé à l'écran pour aider l'utilisateur, mais le backend recalcule chaque ligne et le total.
- Le backend vérifie la cohérence entre le total du billetage et le solde physique de l'arrêté selon la règle métier retenue.
- L'unicité d'une dénomination par arrêté doit être contrôlée côté backend et, si approprié, par contrainte de base de données.

### 3.10 Dates, nombres et validation Zod

- Utiliser `type: "date"` uniquement si le générateur de formulaires du projet le prend effectivement en charge ; sinon conserver le type supporté et créer un composant date partagé.
- La regex `YYYY-MM-DD` vérifie seulement la forme, pas l'existence calendaire de la date. Utiliser le validateur de date disponible dans la version Zod installée ou un validateur calendaire strict.
- Pour les montants FCFA, accepter des entiers positifs/nuls selon le champ et refuser `NaN`, valeurs infinies, décimales non autorisées et valeurs hors bornes.
- Vérifier la conversion des champs HTML : les inputs numériques retournent souvent une chaîne ; la transformation vers `number` doit être explicite et testée.
- Les erreurs Zod doivent être reliées au champ correspondant et présentées en français.

---

## 4. Composants spécialisés

### 4.1 `EncaissementForm.tsx`

Fonctions attendues :

- choisir l'inscription et afficher le reste dû informatif depuis l'API Phase 4 réellement disponible ;
- saisir date, montant, mode de paiement, compte crédité et référence éventuelle ;
- soumettre à l'endpoint de création métier confirmé ;
- afficher le numéro de reçu uniquement après confirmation serveur ;
- présenter les imputations calculées par le backend après succès ;
- afficher clairement le traitement des paiements partiels, trop-perçus et encaissements restant à imputer, selon les règles validées ;
- désactiver le bouton durant la soumission et prévenir les doubles clics ;
- proposer les actions de validation/annulation uniquement si l'utilisateur a le droit et si le statut courant autorise l'action.

**Interdit :** générer un numéro de reçu en appel séparé avant la création, calculer la FIFO comme source de vérité frontend ou envoyer un statut imposé par le client.

### 4.2 `VirementForm.tsx`

- sélection des comptes source et destination ;
- montant, date et motif ;
- validation UI de comptes distincts ;
- action explicite « Enregistrer/Engager » puis « Valider/Exécuter » selon les transitions du backend ;
- afficher le statut et l'historique en lecture seule ;
- masquer/désactiver les actions non autorisées ;
- demander confirmation avant validation, exécution ou annulation ;
- après exécution, rafraîchir les mouvements, soldes, listes et tableau de bord.

### 4.3 `DepenseForm.tsx`

- sélection des catégories de sens `SORTIE` uniquement ;
- saisie des informations de dépense et téléversement du justificatif ;
- année scolaire cohérente entre champ visible et validation ;
- actions métier distinctes : engager, valider, payer, annuler selon le statut et les droits ;
- acteurs et statut affichés en lecture seule ;
- aucune modification libre d'une dépense déjà payée ;
- confirmation explicite avant paiement/annulation.

### 4.4 `ArreteCaisseForm.tsx`

- sélection d'un compte `CAISSE` actif ;
- récupération du solde théorique depuis une API métier confirmée ;
- saisie du solde physique et calcul indicatif de l'écart ;
- le solde théorique et l'écart affichés ne sont jamais envoyés comme valeurs faisant autorité ;
- lien vers la saisie du billetage ;
- action de validation séparée si la séparation des fonctions est exigée ;
- affichage des avertissements en cas d'écart et demande de confirmation avant clôture.

### 4.5 `BilletageForm.tsx`

- tableau dynamique permettant plusieurs lignes de dénomination/quantité ;
- calcul visuel par ligne et du total ;
- envoi d'un seul payload batch atomique, plutôt qu'une boucle d'appels indépendants ;
- validation du total par rapport au solde physique avant soumission, puis vérification autoritaire backend ;
- possibilité d'éditer le billetage uniquement tant que l'arrêté est dans un état modifiable.

### 4.6 `TableauBord.tsx`

Le tableau de bord doit consommer une API d'agrégation documentée. Ne pas charger toutes les listes et recalculer des agrégats côté navigateur.

Données à prévoir, si le métier les confirme :

- soldes courants par compte ;
- soldes agrégés par type de compte ;
- entrées, sorties et flux net sur une période ;
- encaissements et dépenses récents ;
- écarts de caisse récents ;
- alertes : compte négatif, écart de caisse, opérations en attente de validation, etc.

Spécifications techniques :

- définir les filtres temporels et périmètres (groupe scolaire, école, année scolaire, compte) ;
- afficher états chargement, erreur, vide et données ;
- respecter les permissions et le périmètre de l'utilisateur ;
- utiliser la bibliothèque de graphiques déjà installée ; n'en ajouter une que si nécessaire et après accord sur son poids/maintenance ;
- documenter les agrégats et leur définition pour éviter les totaux contradictoires.

---

## 5. Routes frontend

Le fichier `frontend/src/tresorerie/routes.tsx` doit monter réellement chaque composant spécialisé. Les routes ci-dessous illustrent la structure cible : adapter les chemins et imports aux conventions React Router du projet.

```tsx
{
  path: "tresorerie",
  children: [
    { index: true, element: <TableauBord /> },

    { path: "comptes", element: <ResourcePage descripteur={compteDescripteur} /> },
    { path: "categories-mouvement", element: <ResourcePage descripteur={categorieMouvementDescripteur} /> },
    { path: "mouvements", element: <ResourcePage descripteur={mouvementDescripteur} /> },
    { path: "imputations-encaissement", element: <ResourcePage descripteur={imputationEncaissementDescripteur} /> },

    {
      path: "encaissements",
      children: [
        { index: true, element: <ResourcePage descripteur={encaissementDescripteur} /> },
        { path: "nouveau", element: <EncaissementForm /> },
        { path: ":id", element: <EncaissementForm /> },
      ],
    },
    {
      path: "virements",
      children: [
        { index: true, element: <ResourcePage descripteur={virementDescripteur} /> },
        { path: "nouveau", element: <VirementForm /> },
        { path: ":id", element: <VirementForm /> },
      ],
    },
    {
      path: "depenses",
      children: [
        { index: true, element: <ResourcePage descripteur={depenseDescripteur} /> },
        { path: "nouveau", element: <DepenseForm /> },
        { path: ":id", element: <DepenseForm /> },
      ],
    },
    {
      path: "arretes-caisse",
      children: [
        { index: true, element: <ResourcePage descripteur={arreteCaisseDescripteur} /> },
        { path: "nouveau", element: <ArreteCaisseForm /> },
        { path: ":id", element: <ArreteCaisseForm /> },
      ],
    },
    {
      path: "arretes-caisse/:arreteId/billetage",
      element: <BilletageForm />,
    },
  ],
}
```

**Points de contrôle des routes :**

- vérifier qu'aucune route n'est dupliquée ou capturée par une route générique `:id` ;
- s'assurer que les imports relatifs sont corrects depuis `frontend/src/tresorerie/config/` et `routes.tsx` ;
- vérifier la navigation retour, le chargement d'une ressource par ID et la gestion d'un ID invalide ;
- les actions doivent être conditionnées par le rôle et l'état courant, sans considérer ces contrôles frontend comme une autorisation serveur.

---

## 6. Contrats API backend à confirmer et compléter

Ne pas coder sur la seule base d'URLs supposées. Confirmer chaque endpoint dans `urls.py`, les ViewSets/actions, les serializers et OpenAPI. Si un endpoint manque, proposer son ajout backend avec tests.

### 6.1 Contrats fonctionnels nécessaires

| Fonction | Contrat cible indicatif | Garanties backend requises |
|---|---|---|
| Lister les comptes | `GET /api/v1/tresorerie/comptes/` | pagination, filtrage, périmètre et permissions |
| Lire un solde de compte | champ agrégé ou endpoint dédié documenté | calcul fondé sur le grand livre, jamais sur une valeur client |
| Lister les mouvements | `GET /api/v1/tresorerie/mouvements/` | lecture seule, filtres, tri, pagination |
| Créer un encaissement | `POST /api/v1/tresorerie/encaissements/` ou action métier existante | reçu unique, écriture comptable et imputations atomiques selon workflow |
| Consulter le reste dû | endpoint Phase 4 existant à identifier | même logique métier que l'échéancier, résultat informatif |
| Lister les imputations | `GET /api/v1/tresorerie/imputations-encaissement/` | lecture seule |
| Créer/engager un virement | endpoint existant ou action dédiée | compte source différent, validation des fonds/règles, audit |
| Valider/exécuter un virement | action dédiée sur un virement | droits, séparation des fonctions, deux mouvements atomiques |
| Engager une dépense | création/action selon API actuelle | acteur pris de la session, statut initial imposé par serveur |
| Valider une dépense | action dédiée | transition de statut autorisée et journalisée |
| Payer une dépense | action dédiée | mouvement atomique et absence de double paiement |
| Créer un arrêté | création/action dédiée | solde théorique calculé serveur, compte caisse, unicité éventuelle compte/date |
| Obtenir le solde théorique à une date | endpoint métier confirmé | calcul à partir des mouvements validés |
| Enregistrer le billetage | endpoint batch, p. ex. `POST /api/v1/tresorerie/arretes-caisse/{id}/billetage/` | transaction atomique, calcul des montants, unicité des dénominations, total cohérent |
| Lire le tableau de bord | endpoint d'agrégation à définir/documenter | agrégats cohérents, filtrage par périmètre et permissions |

Les chemins ci-dessus sont des **propositions de contrat**, pas une déclaration que ces routes existent déjà. Utiliser les URLs et noms réels du dépôt s'ils diffèrent.

### 6.2 Numéro de reçu

- Supprimer le flux « demander un numéro, puis créer l'encaissement ».
- Générer le numéro côté serveur au sein du cas d'usage de création ou de comptabilisation.
- Garantir l'unicité en base de données et gérer les collisions/concurrences.
- En cas de nouvelle tentative réseau, éviter la création d'un double encaissement au moyen d'une stratégie idempotente si l'architecture le permet.
- Ne montrer le reçu définitif qu'après confirmation du serveur.

### 6.3 Billetage batch

Contrat d'entrée cible :

```json
{
  "lignes": [
    { "denomination": 10000, "quantite": 5 },
    { "denomination": 5000, "quantite": 2 }
  ]
}
```

L'identifiant de l'arrêté peut être dans le chemin ou dans le payload, mais il ne doit pas y avoir deux sources contradictoires. Le client n'envoie pas les montants calculés. Le backend :

1. valide les lignes et les dénominations ;
2. rejette les doublons de dénomination ou les normalise explicitement selon la règle retenue ;
3. calcule `montant = denomination × quantite` pour chaque ligne ;
4. calcule le total ;
5. vérifie l'état modifiable de l'arrêté et la cohérence avec le solde physique ;
6. enregistre toutes les lignes dans une seule transaction ;
7. renvoie le détail calculé et le total validé.

### 6.4 Endpoint du tableau de bord

Définir et documenter un endpoint d'agrégation, par exemple `GET /api/v1/tresorerie/tableau-de-bord/`, uniquement après validation du modèle de données et des conventions du projet. La réponse doit inclure des structures typées pour soldes, flux de période, récents et alertes. Définir les filtres supportés et les permissions appliquées. Ne pas dupliquer la logique comptable dans le frontend.

---

## 7. Services frontend, erreurs, cache et état partagé

### 7.1 Client API et types

- Réutiliser le client commun `apiFetch` ou son équivalent réel.
- Réutiliser les types générés depuis OpenAPI si le projet dispose de cette génération.
- Définir des types d'entrée distincts des types de réponse : ne pas utiliser un type de formulaire qui contient des champs serveur (`id`, statut, acteurs d'audit) puis tenter de les supprimer avec `Omit`.
- Exemple de séparation :
  - `CreerDepensePayload` : champs effectivement fournis par l'utilisateur ;
  - `DepenseDetail` : réponse complète du backend ;
  - `ActionDepensePayload` : uniquement les données nécessaires à une action métier.
- Ne pas dupliquer les déclarations de types si elles peuvent être générées ou partagées.

### 7.2 Services métier frontend

Créer uniquement les fonctions correspondant aux endpoints confirmés, par exemple :

- `listerComptes`, `obtenirCompte` si nécessaires ;
- `creerEncaissement`, `obtenirEncaissement`, `annulerEncaissement` selon le workflow ;
- `creerVirement`, `engagerVirement`, `validerVirement`/`executerVirement` selon les noms d'API réels ;
- `engagerDepense`, `validerDepense`, `payerDepense`, `annulerDepense` ;
- `obtenirSoldeTheoriqueCaisse`, `creerArreteCaisse`, `validerArreteCaisse` ;
- `enregistrerBilletageBatch` ;
- `obtenirTableauBordTresorerie`.

Ne pas créer `genererNumeroRecuUnique()` comme étape indépendante de création. Ne pas créer de fonction `executerVirement` si le backend utilise un workflow distinct engagement/validation ; aligner les noms sur les actions métier réelles.

### 7.3 Gestion standardisée des erreurs réseau

Ne pas lever uniquement des erreurs génériques du type `Erreur: 400`. Utiliser le mécanisme d'erreurs partagé du projet s'il existe. Sinon, créer un normaliseur qui distingue au minimum :

- `400` : erreurs de validation, en associant les messages aux champs ;
- `401` : session absente/expirée et procédure d'authentification du projet ;
- `403` : action non autorisée ;
- `404` : ressource inexistante ;
- `409` : conflit métier, doublon ou concurrence ;
- `429` : limite de requêtes si applicable ;
- `5xx` / réseau : erreur technique, avec possibilité de réessai uniquement pour les opérations sûres.

Ne jamais réessayer automatiquement une mutation financière non idempotente sans garantie explicite du backend. Afficher des notifications standardisées, localisées, accessibles et sans exposer de données sensibles.

### 7.4 Cache et invalidation

- Détecter d'abord si le projet utilise React Query, SWR, Redux, Zustand ou un contexte maison.
- Ne pas ajouter une deuxième bibliothèque de cache si une solution est déjà en place.
- Si React Query est utilisé, invalider les clés de requête pertinentes après mutation : comptes/soldes, mouvements, encaissements/imputations, virements, dépenses, arrêtés/billetages et tableau de bord.
- Si aucune solution de cache n'existe, documenter une stratégie minimale partagée (état de chargement, rafraîchissement après mutation, déduplication des appels si disponible) avant de choisir une dépendance.
- Les données critiques de solde ne doivent pas rester affichées comme fraîchement actualisées après une opération sans rechargement/invalidations.
- Ne pas stocker durablement des montants ou autorisations dérivés comme source de vérité côté navigateur.

### 7.5 État partagé

Ne pas ajouter automatiquement un store global. Déterminer d'abord si les besoins sont déjà couverts par le cache de requêtes et les providers existants.

Données potentiellement partagées :

- année scolaire active ;
- périmètre/groupe scolaire sélectionné ;
- comptes et soldes ;
- filtres de période ;
- état de session et rôles.

La source d'autorité pour l'année scolaire et le périmètre doit rester cohérente avec le reste de l'application. Préférer l'état partagé existant ou les paramètres de route/requête au stockage redondant dans chaque composant.

---

## 8. Sécurité et RBAC

### 8.1 Autorisation côté serveur

Pour chaque endpoint de lecture et de mutation, vérifier :

- authentification requise ;
- rôle autorisé pour l'action ;
- périmètre de groupe scolaire/école ;
- séparation des fonctions lorsque requise ;
- transition de statut autorisée ;
- protection contre l'accès direct par ID à une ressource hors périmètre ;
- protection contre les champs injectés manuellement par un client malveillant.

Les listes `roleEcriture` et contrôles d'affichage frontend sont une aide UX, jamais une barrière de sécurité.

### 8.2 Champs contrôlés par le serveur

Les serializers doivent rejeter ou ignorer explicitement les champs sensibles fournis par le client, selon les conventions du projet. Il ne suffit pas de les cacher visuellement.

Champs à protéger notamment : `statut`, `recu_numero`, `engage_par`, `valide_par`, `fait_par`, `cree_par`, `modifie_par`, `solde_theorique`, `ecart` et les montants calculés du billetage.

### 8.3 Matrice de tests RBAC minimale

Établir la matrice réelle depuis les règles métier et les permissions backend. À titre de test explicite, si le contrat métier confirme que le rôle `COMPTABLE` ne peut pas créer/valider un virement :

- le frontend ne montre pas l'action interdite ;
- un appel API direct du rôle `COMPTABLE` reçoit `403` ;
- aucun virement ni mouvement n'est créé ;
- l'événement de refus est journalisé uniquement si la politique d'audit le prévoit.

Ajouter des tests analogues pour :

- utilisateur `LECTURE` tentant toute mutation ;
- rôle sans droit tentant d'engager/valider/payer une dépense ;
- utilisateur tentant de fournir un autre `valide_par` ;
- utilisateur d'une école tentant d'accéder à une ressource d'un autre périmètre ;
- utilisateur tentant de forcer `statut: VALIDE` dans le payload ;
- double validation ou double paiement concurrents.

Les rôles exacts et les opérations autorisées doivent être confirmés dans la politique du projet ; ne pas inventer une matrice définitive à partir des seuls rôles d'affichage existants.

---

## 9. Plan de développement par entité verticale

Les travaux backend et frontend sont couplés : chaque tranche doit livrer modèle/contrat, règles métier, API, interface et tests ensemble, plutôt que terminer toutes les couches séparément.

### Étape 0 — Audit et cadrage

- lire les instructions du dépôt et les conventions des modules voisins ;
- inspecter modèles, migrations, services, serializers, permissions, ViewSets, URLs et tests de trésorerie ;
- inspecter le module Phase 4 et identifier le modèle d'imputation et les fonctions de calcul du reste dû ;
- vérifier le schéma OpenAPI et la génération TypeScript ;
- confirmer les transitions de statut et la matrice RBAC ;
- confirmer le client API, les notifications, le cache et la bibliothèque graphique ;
- dresser une liste des écarts observés avec références de fichiers et lignes.

**Critère de sortie :** tableau des composants existants/manquants et contrats confirmés ; aucun endpoint supposé présenté comme réel.

### Étape 1 — Compte

- vérifier modèle, contraintes et source du solde ;
- exposer/ajuster les endpoints de lecture et d'administration autorisée ;
- distinguer solde initial, solde courant et mouvements d'ajustement ;
- implémenter le descripteur et la liste/détail ;
- tester rôles, périmètre et cohérence du solde.

**Critère d'acceptation :** solde affiché depuis le backend et non modifiable par un formulaire ordinaire.

### Étape 2 — Catégorie de mouvement

- vérifier le modèle et les valeurs de `sens` ;
- mettre en place le CRUD autorisé ;
- filtrer les catégories compatibles dans le formulaire de dépense ;
- tester qu'une catégorie `ENTREE` ne peut pas être utilisée pour une dépense, même via appel direct.

### Étape 3 — Encaissement + imputation

Traiter ces deux objets ensemble, car ils sont couplés à la Phase 4.

- confirmer les échéances, frais, imputations et règles de surpaiement existantes ;
- décider du workflow et des statuts, notamment le cas `A_IMPUTER` ;
- mettre en place la création atomique, le numéro de reçu unique et l'idempotence si possible ;
- calculer l'imputation FIFO côté backend ;
- exposer le reçu et le détail des imputations en lecture ;
- créer le formulaire, les vues liste/détail et les actions autorisées ;
- tester paiement partiel, paiement couvrant plusieurs échéances, montant insuffisant, trop-perçu et concurrence.

**Critère d'acceptation :** aucun reçu orphelin, aucune double imputation et aucun calcul FIFO faisant autorité côté frontend.

### Étape 4 — Virement

- confirmer les états et transitions exactes (brouillon/engagé/en attente/validé/exécuté/annulé, selon le modèle réel) ;
- garantir l'atomicité des deux mouvements et la cohérence des soldes ;
- mettre en place les actions backend de workflow ;
- créer le descripteur de liste et le composant `VirementForm` ;
- monter effectivement les routes `virements/nouveau` et `virements/:id` ;
- tester permissions, séparation des fonctions, fonds insuffisants, comptes identiques, double exécution et concurrence.

**Critère d'acceptation :** le composant spécialisé est réellement accessible depuis les routes et aucun statut ne peut être forcé par le payload.

### Étape 5 — Dépense

- confirmer les champs obligatoires et la règle d'année scolaire ;
- implémenter les transitions d'engagement, validation, paiement et annulation ;
- renseigner les acteurs côté serveur ;
- garantir le mouvement comptable atomique au paiement et empêcher un double paiement ;
- intégrer le justificatif avec le système de fichiers du projet ;
- créer les routes et le composant spécialisé ;
- tester catégories `SORTIE`, année scolaire, permissions, transition invalide, double paiement et annulation.

**Critère d'acceptation :** `annee_scolaire` a une règle identique dans le formulaire et le schéma ; les acteurs/statuts ne sont jamais contrôlés par le client.

### Étape 6 — Arrêté de caisse + billetage

- confirmer calcul du solde théorique à la date de clôture ;
- définir les règles d'écart, de validation et d'unicité compte/date ;
- mettre en place la création/validation de l'arrêté ;
- créer l'API batch atomique du billetage ;
- calculer les montants de ligne et le total côté backend ;
- implémenter les formulaires et la navigation entre arrêté et billetage ;
- tester total exact, écart positif/négatif, dénomination dupliquée, arrêté déjà validé, concurrence et droits.

**Critère d'acceptation :** solde théorique calculé serveur ; toutes les lignes de billetage sont enregistrées ou aucune ne l'est.

### Étape 7 — Tableau de bord

- définir la réponse d'agrégation et les filtres ;
- documenter les formules d'entrées, sorties, flux net et soldes ;
- implémenter l'endpoint avec périmètre et permissions ;
- ajouter les types/services frontend ;
- utiliser la bibliothèque graphique existante ou faire approuver une dépendance ;
- brancher cache/invalidation et états de chargement/erreur/vide ;
- tester agrégats sur un jeu de données de référence et filtrage par périmètre.

**Critère d'acceptation :** les chiffres du tableau de bord correspondent aux API de détail/grand livre sur le même périmètre et la même période.

### Étape 8 — Grand livre unifié / Mouvement

- finaliser après les opérations productrices de mouvements ;
- vérifier l'immutabilité des mouvements postés et leur origine ;
- fournir filtres, tri, pagination et détails ;
- tester rapprochement entre mouvements et encaissements/virements/dépenses ;
- vérifier qu'aucun endpoint frontend ne permet d'écrire directement dans le grand livre.

### Étape 9 — Stabilisation transversale

- génération/validation OpenAPI et types ;
- tests unitaires, intégration, API et E2E ;
- audit RBAC, champs sensibles, concurrence et idempotence ;
- audit accessibilité et UX des erreurs ;
- tests de performance sur un volume représentatif ;
- tests de non-régression de toutes les phases antérieures ;
- documentation des workflows, états et endpoints.

---

## 10. Stratégie de cache et actualisation après mutation

Après chaque opération réussie, invalider ou recharger les ressources dépendantes :

| Mutation | Données à actualiser |
|---|---|
| Création/validation d'un encaissement | encaissements, reçu, imputations, mouvements, soldes de comptes, reste dû si mis en cache, tableau de bord |
| Validation/exécution d'un virement | virement, mouvements, soldes source/destination, tableau de bord |
| Paiement d'une dépense | dépense, mouvements, solde du compte débité, tableau de bord |
| Création/validation d'un arrêté | arrêté, solde théorique/écart, tableau de bord/alertes |
| Enregistrement du billetage | lignes de billetage, total physique, arrêté, écarts et tableau de bord |
| Modification d'un compte/catégorie | liste/détail correspondant et sélecteurs qui les consomment |

Les noms de clés de cache doivent suivre la solution déjà utilisée dans le dépôt. En l'absence de cache, forcer un rafraîchissement explicite après succès.

---

## 11. Tests et critères de conformité

### 11.1 Vérifications automatiques

Adapter les commandes aux scripts réellement présents dans le dépôt :

- migrations : vérifier l'état et les migrations en attente ;
- tests backend : tests de trésorerie et tests des modules dépendants ;
- schéma OpenAPI : génération sans erreur et vérification des endpoints/actions ;
- génération des types API si configurée ;
- TypeScript : `npm run typecheck` ou script équivalent ;
- tests frontend : `npm test` ou script équivalent ;
- lint/build : commandes du projet ;
- E2E : parcours de trésorerie et non-régression.

Ne pas supposer qu'un nom de commande existe sans vérifier `package.json`, la configuration Django et la CI.

### 11.2 Vérifications métier

**Encaissement**
- numéro de reçu unique sous concurrence ;
- encaissement, mouvement et imputations atomiques selon le workflow ;
- état initial défini par le backend ;
- reste dû recalculé côté serveur ;
- surpaiement traité conformément à une règle explicite ;
- absence de double soumission/double comptabilisation.

**FIFO / imputation**
- exemple de référence : échéance E1 = 100 000, E2 = 80 000, paiement = 150 000 ; résultat attendu si la FIFO s'applique : E1 = 100 000, E2 = 50 000 ;
- ordre chronologique déterministe en cas d'échéances de même date ;
- aucune imputation au-delà du montant encaissé ;
- somme des imputations cohérente avec la politique d'imputation et de solde non imputé.

**Virement**
- comptes distincts ;
- exemple de référence : compte A = 500 000, compte B = 100 000, transfert = 200 000 ; après exécution : A = 300 000, B = 300 000 ;
- deux mouvements créés atomiquement ;
- aucun double débit/crédit en cas de double clic ou requête concurrente ;
- rôles non autorisés refusés par l'API.

**Dépense**
- catégorie de sortie uniquement ;
- workflow engagement → validation → paiement conforme au modèle réel ;
- exemple de référence : solde = 500 000, dépense payée = 100 000 ; solde = 400 000 ;
- pas de double paiement ;
- acteur et statut imposés par le serveur.

**Arrêté et billetage**
- solde théorique issu des mouvements validés à la date ;
- écart = solde physique − solde théorique ;
- exemple : théorique = 250 000, physique = 250 000, écart = 0 ;
- exemple : théorique = 250 000, physique = 240 000, écart = −10 000 ;
- somme billetage = solde physique si cette règle est celle retenue ;
- batch atomique et calcul des montants côté backend.

**Tableau de bord**
- agrégats identiques aux données sources sur un même filtre ;
- filtres et permissions respectés ;
- affichage d'un état vide sans erreur ;
- invalidation après chaque mutation pertinente.

### 11.3 Tests de sécurité explicites

- rôle lecture : toute mutation refusée par l'API ;
- rôle sans autorisation de virement : création/validation refusée par l'API ;
- payload malveillant contenant `statut: "VALIDE"` : refusé ou ignoré selon contrat, sans contourner le workflow ;
- payload contenant `valide_par` ou `fait_par` d'un autre utilisateur : non accepté comme autorité ;
- accès à une ressource hors périmètre : refusé ;
- mouvement ou imputation en lecture seule : `POST`, `PATCH`, `PUT`, `DELETE` interdits ;
- double clic, répétition réseau et requêtes concurrentes sur les opérations financières ;
- absence de fuite de secrets ou données sensibles dans les logs.

### 11.4 Tests frontend/UX

- erreurs de validation affichées près du champ concerné ;
- réponses `401`, `403`, `404`, `409` et `5xx` traitées distinctement ;
- boutons désactivés pendant une mutation ;
- confirmation avant les actions irréversibles ;
- listes et formulaires avec états chargement/erreur/vide/succès ;
- date invalide (ex. 30 février) rejetée ;
- valeurs numériques converties et validées correctement ;
- navigation directe vers `/nouveau` et `/:id` fonctionnelle ;
- cache rafraîchi après mutation ;
- accès par URL directe sans permission refusé côté backend.

---

## 12. Definition of Done

Une tranche verticale est considérée terminée seulement si :

- [ ] son contrat backend a été vérifié dans les URLs, serializers, permissions et OpenAPI ;
- [ ] les validations backend couvrent les invariants métier ;
- [ ] les transactions financières sont atomiques et les opérations concurrentes protégées ;
- [ ] les champs serveur (statut, acteurs, numéro de reçu, soldes calculés) ne sont pas contrôlables par le frontend ;
- [ ] les routes montent le bon composant et les parcours de liste/création/détail fonctionnent ;
- [ ] les erreurs réseau et erreurs métier sont présentées correctement ;
- [ ] les caches/données dépendantes sont actualisés après mutation ;
- [ ] les tests unitaires, API, RBAC et E2E pertinents passent ;
- [ ] les types générés, lint, typecheck et build passent selon les scripts du dépôt ;
- [ ] aucune régression n'est introduite dans les phases existantes ;
- [ ] la documentation est mise à jour.

---

## 13. Résumé des corrections intégrées

| Priorité | Correction appliquée au plan |
|---|---|
| P0 | Routes `virements/nouveau` et `virements/:id` ajoutées pour monter `VirementForm` |
| P0 | Retrait des statuts et acteurs d'audit des formulaires éditables |
| P0 | Cohérence obligatoire/optionnelle de `annee_scolaire` explicitement exigée |
| P0 | Numéro de reçu généré côté backend dans le flux atomique, sans pré-génération séparée |
| P0 | Solde théorique, écarts et montants calculés protégés côté serveur |
| P1 | Billetage envoyé en batch atomique ; montants calculés backend |
| P1 | Endpoint d'agrégation du tableau de bord à définir et documenter |
| P1 | Stratégie de cache/invalidation et rafraîchissement après mutations ajoutée |
| P1 | Normalisation des erreurs HTTP et stratégie de retry sûre ajoutées |
| P1 | Tests RBAC directs API et tests de contournement de workflow explicités |
| P1 | FIFO clairement placée côté backend ; frontend limité à l'affichage du résultat |
| P2 | Type de champ date à adapter au framework réel et validation calendaire stricte |
| P2 | Suppression des validations redondantes et des types `Omit` inutiles |
| P2 | Bibliothèque de graphiques à réutiliser si déjà présente, sinon à choisir explicitement |
| Architecture | Développement réorganisé par entité verticale plutôt que par couches horizontales |

**Ordre recommandé pour l'agent de code :** commencer par l'étape 0 (audit avec preuves), puis livrer une tranche verticale à la fois. Ne pas lancer une implémentation massive de toutes les couches avant d'avoir confirmé les contrats et la sécurité des opérations financières.
