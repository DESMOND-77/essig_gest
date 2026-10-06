# Phase 4 v2 — Scolarité, Facturation & Gestion financière étudiante

**Date :** 2026-10-06
**Version :** 2.0
**Statut :** SPECIFICATION FINALE — PRÊTE POUR IMPLÉMENTATION
**Priorité :** Haute

---

# 0. Directive générale à l'agent de code

Cette phase doit être implémentée **dans le dépôt existant**, sans réécrire ni dégrader les phases précédentes.

L'agent doit :

1. analyser l'architecture existante avant toute modification ;
2. identifier les modèles, serializers, ViewSets, permissions, services, URLs, tests et conventions déjà présents ;
3. réutiliser les abstractions existantes lorsqu'elles correspondent aux conventions du projet ;
4. ne jamais créer une seconde implémentation d'une fonctionnalité déjà existante ;
5. respecter le SQL de référence lorsqu'il est disponible ;
6. respecter les conventions ORM `D-ORM-*` ;
7. respecter les conventions API et OpenAPI existantes ;
8. respecter le RBAC serveur existant ;
9. utiliser exclusivement des montants monétaires `Decimal` côté Python/Django et `DECIMAL(...,0)` côté SQL ;
10. ne jamais utiliser de `float` pour les montants financiers ;
11. implémenter les règles métier dans des **services métier transactionnels**, et non dans les serializers ou les ViewSets ;
12. ne jamais considérer le frontend comme une couche de sécurité ;
13. écrire les tests avant de déclarer une fonctionnalité terminée ;
14. ne pas inventer de comportement absent de cette spécification ;
15. lorsqu'une dépendance appartient à une phase ultérieure, utiliser une interface/port explicite plutôt que coupler directement le module à une implémentation future.

Toute ambiguïté restante doit être résolue en faveur :

* du SQL de référence ;
* puis des migrations existantes ;
* puis des conventions ORM du projet ;
* puis de cette spécification.

L'agent ne doit pas modifier le périmètre de cette phase sans justification documentée.

---

# 1. Références

Références prioritaires :

* `2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md`

  * §3 Module 3
* `2026-08-30-choix-technologies-sis-design.md`
* `2026-09-03-conventions-portage-orm-design.md`
* `db/migrations/`
* `db/tests/`
* prompt maître §16 Phase 4
* code Django existant des phases 1 à 3

**Hiérarchie des sources :**

```text
SQL / migrations de référence
        ↓
modèle ORM existant
        ↓
présente spécification Phase 4 v2
        ↓
implémentation Django/DRF
        ↓
OpenAPI
        ↓
types TypeScript
        ↓
Frontend
```

Aucune implémentation ne doit créer une divergence entre ces couches.

---

# 2. Objectif

Rendre les fonctions de scolarité et de gestion financière étudiante pilotables de bout en bout :

```text
DB
 ↓
Django ORM
 ↓
Services métier
 ↓
DRF
 ↓
OpenAPI
 ↓
Types TypeScript
 ↓
Frontend
```

La phase couvre :

* grille tarifaire ;
* frais annexes ;
* génération des échéanciers ;
* bourses ;
* imputation des paiements ;
* situation financière ;
* reste à payer ;
* fiches de scolarité ;
* RBAC ;
* audit ;
* tests backend/frontend.

Les opérations financières critiques doivent être :

* transactionnelles ;
* idempotentes lorsque nécessaire ;
* auditables ;
* cohérentes en cas de concurrence ;
* calculées sans flottants.

---

# 3. Périmètre

## 3.1 Inclus

### Scolarité financière

* Modalités de paiement ;
* frais annexes ;
* types de frais ;
* frais applicables à une inscription ;
* échéances ;
* bourses ;
* imputations de paiement ;
* situation de paiement ;
* reste à payer ;
* fiches de scolarité.

### API

Toutes les APIs de la phase sont exposées sous :

```text
/api/v1/scolarite/
```

avec :

* pagination ;
* filtres ;
* recherche ;
* ordering ;
* validation DRF ;
* OpenAPI ;
* RBAC serveur.

### Frontend

Pour les fonctionnalités réellement disponibles dans la phase :

* liste ;
* création ;
* édition ;
* détail ;
* actions métier ;
* affichage des erreurs ;
* états de chargement ;
* états vides ;
* états d'erreur ;
* responsive.

---

# 4. Hors périmètre

Les modules suivants ne doivent pas être réimplémentés :

* référentiel ;
* personnes ;
* trésorerie complète ;
* paie ;
* résultats ;
* délibérations ;
* documents ;
* imports ;
* reporting avancé ;
* prélèvement automatique ;
* rétroactions bancaires ;
* passerelles de paiement ;
* multi-devise ;
* gestion avancée des avoirs ;
* notes de crédit ;
* modification manuelle libre d'un échéancier.

La Phase 4 peut cependant **consommer les contrats/interfaces nécessaires** de ces modules.

---

# 5. Architecture financière

La séparation suivante est obligatoire.

```text
                ┌─────────────────────────┐
                │       SCOLARITÉ         │
                │                         │
                │ Modalité                 │
                │ Frais                    │
                │ Échéance                 │
                │ Bourse                   │
                │ Situation financière     │
                └───────────┬─────────────┘
                            │
                            ▼
                 ┌────────────────────┐
                 │ Paiement /         │
                 │ Imputation         │
                 │ métier             │
                 └──────────┬─────────┘
                            │
                            ▼
                ┌──────────────────────┐
                │   TRÉSORERIE         │
                │ Encaissement         │
                │ Compte / mouvement   │
                └──────────────────────┘
```

La Phase 4 ne doit pas réimplémenter le module Trésorerie.

Elle définit toutefois le contrat nécessaire :

```text
Encaissement
      ↓
PaiementService
      ↓
ImputationPaiement
      ↓
Echeance
```

---

# 6. Principes financiers obligatoires

## 6.1 Monnaie

Toutes les valeurs monétaires sont en :

```text
FCFA
```

et doivent être représentées par :

```text
Django DecimalField(max_digits=12, decimal_places=0)
```

Aucun :

```python
float
```

ne doit être utilisé pour un montant.

---

## 6.2 Calcul du reste

Le reste à payer est calculé :

```text
reste = total_du_net - total_impute
```

Il n'est pas stocké comme agrégat persistant.

---

## 6.3 Source de vérité

Le montant payé d'une échéance est dérivé des imputations :

```text
montant_impute =
    SUM(ImputationPaiement.montant)
```

`montant_paye` ne doit donc pas devenir une seconde source de vérité indépendante.

Si le modèle SQL de référence impose `montant_paye`, il est maintenu comme **champ dérivé contrôlé par le service d'imputation**, jamais modifiable directement par API.

---

# 7. Grille tarifaire

## 7.1 Règles métier

### RM-30

Une modalité de paiement dépend de :

```text
(niveau_id, annee_scolaire_id)
```

et est indépendante de l'option.

### RM-31

Unicité :

```text
UNIQUE(niveau_id, annee_scolaire_id, montant)
```

### RM-32

Montant :

```text
DECIMAL(12,0)
```

### RM-33

Le montant doit être strictement supérieur à zéro.

### RM-34

Une grille tarifaire est liée à une année scolaire.

Une modalité utilisée par une inscription ne doit pas pouvoir être modifiée rétroactivement si cette modification change le calcul d'un échéancier existant.

**Principe :**

```text
Configuration tarifaire
        ↓
création inscription
        ↓
snapshot financier dans échéances
```

Une modification ultérieure de la grille ne modifie jamais automatiquement les échéances déjà générées.

---

# 8. Modèle `ModalitePaiement`

```text
ModalitePaiement
----------------
id
niveau_id
annee_scolaire_id
montant
date_creation
date_modification
```

Contraintes :

```text
UNIQUE(niveau_id, annee_scolaire_id, montant)

montant > 0
```

---

# 9. Génération des échéances : règle définitive

La configuration tarifaire doit permettre de déterminer sans ambiguïté :

* le montant total ;
* le nombre d'échéances ;
* le montant de chaque échéance ;
* la date de chaque échéance.

**L'agent ne doit pas déduire arbitrairement ces valeurs à partir du seul champ `montant`.**

Si le SQL de référence possède une structure plus détaillée que `ModalitePaiement`, elle doit être conservée.

Sinon, la configuration doit exposer explicitement :

```text
nombre_echeances
```

et/ou les informations nécessaires au calendrier.

La règle suivante est obligatoire :

```text
échéance 0
    = inscription / réinscription

échéances 1..N
    = échéances de scolarité
```

---

# 10. API `ModalitePaiement`

```text
GET    /api/v1/scolarite/modalites-paiement/
POST   /api/v1/scolarite/modalites-paiement/
GET    /api/v1/scolarite/modalites-paiement/{id}/
PUT    /api/v1/scolarite/modalites-paiement/{id}/
PATCH  /api/v1/scolarite/modalites-paiement/{id}/
DELETE /api/v1/scolarite/modalites-paiement/{id}/
```

Filtres :

```text
niveau
annee_scolaire
montant_min
montant_max
```

Recherche :

```text
niveau__code
niveau__libelle
annee_scolaire__libelle
```

Ordering :

```text
niveau__code
annee_scolaire__libelle
montant
```

---

# 11. Frais annexes

## 11.1 `TypeFrais`

Un type de frais représente une catégorie :

```text
INSCRIPTION
SCOLARITE
ACTIVITE
CANTINE
TRANSPORT
...
```

Champs :

```text
id
libelle
code
description
date_creation
```

Contraintes :

```text
libelle UNIQUE
code UNIQUE
```

---

# 12. Frais applicables

La configuration des frais doit permettre d'identifier précisément :

```text
niveau
année scolaire
type de frais
montant
obligatoire
actif
```

Lorsque ces champs existent déjà dans le backend de Phase 3, ils doivent être conservés et étendus plutôt que recréés.

Le principe est :

```text
TypeFrais
      ↓
FraisApplicable
      ├── niveau
      ├── année
      ├── type
      ├── montant
      ├── obligatoire
      └── actif
```

Cela permet notamment :

```text
INSCRIPTION      50 000
CANTINE          20 000
ACTIVITES        10 000
TRANSPORT        30 000
```

sans limiter le modèle à un unique frais par niveau/année.

---

# 13. Règles des frais

### RM-35

`TypeFrais` = catégorie.

### RM-36

Un frais applicable est lié à une année et éventuellement à un niveau.

### RM-37

`TypeFrais.libelle` unique.

### RM-38

L'unicité d'un frais applicable doit inclure son type :

```text
UNIQUE(
    niveau_id,
    annee_scolaire_id,
    type_frais_id
)
```

si cette structure est compatible avec le SQL de référence.

### RM-39

Montants :

```text
DECIMAL(12,0)
```

### RM-40

Montant :

```text
>= 0
```

### RM-41

Les frais sont intégrés à l'échéancier au moment de sa génération.

Ils ne doivent pas modifier rétroactivement une échéance existante.

---

# 14. API frais

```text
/api/v1/scolarite/types-frais/
/api/v1/scolarite/frais-inscription/
```

CRUD complet.

Permissions :

```text
lecture : authentifié

écriture :
    DIRECTION
    COMPTABLE
```

---

# 15. Échéances

## 15.1 Règles

### RM-42

L'échéancier est généré automatiquement lors de la création/validation d'une inscription.

### RM-43

Numérotation :

```text
0 = inscription/réinscription
1..N = échéances suivantes
```

### RM-44

Les montants sont issus de la configuration tarifaire figée au moment de l'inscription.

### RM-45

Les bourses réduisent la dette financière selon leurs règles d'application.

### RM-46

Les dates d'échéance sont calculées au moment de la génération.

### RM-47

Le statut financier est dérivé.

### RM-48

Les paiements sont imputés selon FIFO par défaut.

---

# 16. Modèle `Echeance`

```text
Echeance
--------
id
inscription_id
numero
montant
date_echeance
date_paiement
montant_paye
statut
date_creation
```

Contraintes :

```text
UNIQUE(inscription_id, numero)

montant >= 0

montant_paye >= 0

montant_paye <= montant
```

Si `montant_paye` est conservé, il est géré exclusivement par `PaiementService`.

---

# 17. Statuts des échéances

Ne pas stocker un état temporel inutilement mutable.

Statuts de base :

```text
A_PAYER
PARTIELLEMENT_PAYE
PAYE
```

`EN_RETARD` est dérivé :

```text
date_echeance < date_du_jour
ET reste > 0
```

Donc :

```text
statut = EN_RETARD
```

est une représentation API calculée, pas nécessairement une valeur persistée.

---

# 18. API échéances

```text
GET /api/v1/scolarite/echeances/
GET /api/v1/scolarite/echeances/{id}/
```

Les modifications directes du montant ou de la date sont interdites après génération.

L'action métier est :

```text
POST /api/v1/scolarite/echeances/{id}/payer/
```

mais cette action ne doit pas contourner le service d'imputation.

---

# 19. Imputation des paiements

## 19.1 Nouvelle entité logique obligatoire

Introduire :

```text
ImputationPaiement
```

avec au minimum :

```text
id
encaissement_id
echeance_id
montant
date_creation
```

et, si prévu par le modèle d'audit :

```text
utilisateur
```

Une imputation signifie :

```text
une partie d'un encaissement
affectée à une échéance
```

---

# 20. Exemple d'imputation

Encaissement :

```text
700 000 FCFA
```

Échéances :

```text
E0 = 300 000
E1 = 250 000
E2 = 400 000
```

FIFO :

```text
E0 ← 300 000
E1 ← 250 000
E2 ← 150 000
```

Reste :

```text
E2 = 250 000
```

L'historique doit permettre de retrouver ces trois imputations.

---

# 21. FIFO

Ordre obligatoire :

```text
date_echeance ASC
numero ASC
id ASC
```

Le dernier critère garantit un ordre déterministe.

Une échéance entièrement payée n'est jamais sélectionnée par FIFO.

---

# 22. Concurrence des paiements

L'imputation doit être protégée contre deux paiements simultanés.

Le service doit utiliser une transaction :

```python
transaction.atomic()
```

et verrouiller les lignes financières concernées avec :

```python
select_for_update()
```

avant de calculer les montants disponibles.

Test obligatoire :

```text
deux paiements simultanés
→ aucune double imputation
→ aucun montant négatif
```

---

# 23. Trop-perçu

Le comportement doit être explicite.

Par défaut :

```text
encaissement > dette restante
```

ne doit pas être silencieusement affecté à une échéance au-delà de son montant.

Le surplus devient :

```text
crédit / avoir à traiter par la trésorerie
```

ou est refusé tant que le contrat Trésorerie n'est pas disponible.

L'agent ne doit pas inventer une comptabilisation.

---

# 24. Bourses

## 24.1 Modèle

```text
Bourse
------
id
etudiant_id
annee_scolaire_id
type
pourcentage
montant_fixe
date_attribution
date_fin_validite
date_creation
```

Exactement un des deux :

```text
pourcentage
OU
montant_fixe
```

---

# 25. Contraintes bourse

```text
0 <= pourcentage <= 100
```

ou :

```text
montant_fixe >= 0
```

mais jamais les deux simultanément.

---

# 26. Règle de couverture

Pour une échéance :

```text
base = montant restant de l'échéance
```

Si bourse en pourcentage :

```text
prise_en_charge =
    base × pourcentage / 100
```

Si bourse fixe :

```text
prise_en_charge =
    min(base, montant_restant_de_la_bourse)
```

Une bourse ne peut jamais créer une dette négative.

---

# 27. Traçabilité des bourses

La simple présence de :

```text
Bourse
```

ne suffit pas.

La prise en charge doit pouvoir être expliquée.

Introduire une notion d'allocation, par exemple :

```text
BourseImputation
----------------
bourse_id
echeance_id
montant
date_creation
```

ou l'équivalent prévu par le SQL de référence.

Ainsi :

```text
Bourse 80 %
   ↓
Echéance 500 000
   ↓
400 000 pris en charge
   ↓
100 000 restant étudiant
```

est auditable.

---

# 28. Bourses concurrentes

Deux bourses actives ne peuvent pas couvrir la même période et la même dette sans règle explicite.

Par défaut :

```text
bourse active existante
+
nouvelle bourse couvrant la même période
=
409 BourseConflitException
```

sauf si le modèle de référence prévoit explicitement le cumul.

---

# 29. Application d'une bourse

L'attribution d'une bourse :

1. est transactionnelle ;
2. vérifie les conflits ;
3. calcule les allocations ;
4. crée les traces d'allocation ;
5. recalcule la situation ;
6. crée l'audit.

Une bourse nouvellement attribuée ne modifie jamais les paiements historiques.

---

# 30. Situation de paiement

La situation n'est pas une table métier persistante.

Elle est calculée à partir de :

```text
Inscription
Échéances
Imputations
Allocations de bourse
```

et, lorsque nécessaire :

```text
Encaissements
```

---

# 31. Calcul financier officiel

Pour une inscription :

```text
total_brut
    = Σ échéances.montant

total_bourse
    = Σ allocations_bourse.montant

total_du_net
    = total_brut - total_bourse

total_paye
    = Σ imputations.montant

reste_a_payer
    = total_du_net - total_paye
```

Le résultat ne doit pas être négatif.

Un éventuel surplus est traité comme crédit/avoir selon le contrat Trésorerie.

---

# 32. Attention aux jointures SQL

Il est interdit d'effectuer directement :

```sql
echeances
JOIN encaissements
```

puis :

```sql
SUM(echeances.montant)
SUM(encaissements.montant)
```

sans pré-agrégation.

Le risque de multiplication des lignes doit être éliminé.

Utiliser :

```text
sous-requêtes
```

ou :

```text
CTE
```

ou :

```text
agrégations séparées
```

selon les conventions du projet.

---

# 33. Situation par inscription

```text
GET /api/v1/scolarite/situations-paiement/{inscription_id}/
```

Retour minimal :

```json
{
  "inscription": 123,
  "total_brut": "1500000",
  "total_bourse": "500000",
  "total_du_net": "1000000",
  "total_paye": "700000",
  "reste_a_payer": "300000",
  "statut": "PARTIELLEMENT_PAYE"
}
```

---

# 34. Situation par étudiant

```text
GET /api/v1/scolarite/etudiants/{id}/situation-paiement/
```

Elle agrège les inscriptions concernées.

Elle ne doit pas mélanger plusieurs années scolaires sans les identifier.

Le résultat doit pouvoir être filtré par :

```text
annee_scolaire
```

---

# 35. API liste des situations

```text
GET /api/v1/scolarite/situations-paiement/
```

Filtres :

```text
etudiant
inscription
annee_scolaire
statut
reste_a_payer_min
reste_a_payer_max
```

Recherche :

```text
nom
prenom
numero_etudiant
```

Ordering :

```text
etudiant__nom
reste_a_payer
```

---

# 36. Fiches de scolarité

La fiche est une **vue métier**, pas une nouvelle source de données.

En Phase 4, elle doit agréger uniquement les données réellement disponibles.

## Disponible immédiatement

* identité ;
* inscription ;
* niveau ;
* année scolaire ;
* échéances ;
* bourses ;
* paiements ;
* reste à payer.

## Dépendant des futures phases

* notes ;
* moyennes ;
* résultats ;
* délibérations ;
* présence ;
* comportement ;
* appréciations.

Ces sections doivent utiliser des interfaces extensibles et ne doivent pas être simulées avec de fausses données.

---

# 37. Génération PDF

La génération PDF de base peut utiliser l'outil prévu par le projet, notamment WeasyPrint si déjà installé.

Elle ne doit pas inclure :

* stockage documentaire avancé ;
* signature numérique complète ;
* gestion de versions documentaire complexe ;
* envoi email obligatoire.

Ces fonctions restent dépendantes des modules concernés.

---

# 38. API fiches

```text
GET  /api/v1/scolarite/fiches-scolarite/
POST /api/v1/scolarite/fiches-scolarite/generate/
GET  /api/v1/scolarite/fiches-scolarite/{id}/
```

La liste peut être virtuelle si aucun historique de génération n'est stocké.

**Important :**

La spec ne doit pas prétendre fournir un historique de versions si aucun modèle persistant n'existe.

Deux stratégies sont autorisées :

### Mode A — génération à la demande

Aucun stockage :

```text
POST generate
→ PDF
```

### Mode B — historique

Si le projet possède un modèle documentaire approprié :

```text
FicheGeneration
```

peut conserver :

```text
etudiant
inscription
periode
type
date_generation
auteur
```

Le stockage binaire du document reste hors périmètre Phase 4 si le module Documents n'est pas encore disponible.

---

# 39. Workflow inscription → échéancier

Le workflow officiel est :

```text
POST inscription
      ↓
validation inscription
      ↓
transaction.atomic()
      ↓
InscriptionService.generer_echeancier()
      ↓
lecture configuration tarifaire
      ↓
création échéance 0
      ↓
création échéances 1..N
      ↓
application bourses existantes
      ↓
audit
      ↓
commit
```

Si une étape échoue :

```text
ROLLBACK COMPLET
```

Aucune inscription partiellement créée ne doit rester avec un échéancier incomplet.

---

# 40. Idempotence échéancier

Une génération déjà effectuée ne doit pas créer de doublons.

Cas :

```text
generer_echeancier(inscription=10)
```

appelé deux fois.

Résultat :

```text
une seule série d'échéances
```

et non :

```text
deux séries
```

Le service doit soit :

* retourner l'échéancier existant ;
* soit lever une exception métier contrôlée.

---

# 41. Workflow paiement

Le paiement suit :

```text
Encaissement
    ↓
PaiementService
    ↓
validation
    ↓
transaction.atomic()
    ↓
verrouillage échéances
    ↓
FIFO
    ↓
création imputations
    ↓
mise à jour champs dérivés
    ↓
audit
    ↓
commit
```

La création de l'encaissement et son imputation doivent être cohérentes transactionnellement.

Si le module Trésorerie n'est pas encore disponible, implémenter un **port/service contractuel**, pas une fausse table Trésorerie.

---

# 42. Workflow bourse

```text
POST bourse
      ↓
validation
      ↓
contrôle chevauchement
      ↓
transaction.atomic()
      ↓
création bourse
      ↓
allocation aux échéances
      ↓
création traces
      ↓
audit
      ↓
commit
```

---

# 43. Services métier obligatoires

Les règles métier ne doivent pas être concentrées dans les ViewSets.

Créer ou réutiliser :

```text
scolarite/services/
    echeancier.py
    paiement.py
    bourse.py
    situation.py
    fiche_scolarite.py
```

Services minimaux :

```python
generer_echeancier(inscription)
```

```python
imputer_encaissement(encaissement)
```

```python
appliquer_bourse(bourse)
```

```python
calculer_situation_paiement(inscription)
```

```python
generer_fiche_scolarite(...)
```

---

# 44. Transactions

Toutes les opérations suivantes doivent être transactionnelles :

```text
création inscription + échéancier
paiement + imputations
attribution bourse + allocations
annulation financière
```

Utiliser :

```python
transaction.atomic()
```

et les verrous nécessaires.

---

# 45. RBAC

## Lecture

```text
IsAuthenticated
```

## Configuration tarifaire

```text
DIRECTION
COMPTABLE
```

## Paiement

```text
DIRECTION
COMPTABLE
SCOLARITE
```

selon le contexte métier.

## Bourse

```text
DIRECTION
```

## Génération fiche

```text
DIRECTION
SCOLARITE
```

Le rôle `LECTURE` ne peut jamais écrire.

---

# 46. Autorisation objet

Le simple rôle ne suffit pas pour les ressources sensibles.

Lorsque le contexte le requiert, contrôler :

```text
utilisateur
→ établissement
→ périmètre de responsabilité
→ étudiant/inscription
```

Aucun utilisateur ne doit accéder à une ressource d'un établissement hors de son périmètre.

---

# 47. Audit

Toutes les opérations suivantes sont auditées :

```text
création/modification/suppression tarif
création/modification frais
génération échéancier
paiement
imputation
bourse
allocation bourse
annulation
modification financière autorisée
génération fiche
```

L'audit doit contenir au minimum :

```text
utilisateur
action
table_cible
objet_id
timestamp
snapshot_avant
snapshot_apres
```

si ces champs existent dans `JournalAudit`.

Ne jamais enregistrer :

```text
mot de passe
token
secret
```

---

# 48. Exceptions métier

Créer/réutiliser :

```text
ConflitPaiementException
BourseConflitException
EcheancierDejaGenereException
EcheanceDejaPayeeException
ImputationInvalideException
MontantPaiementInvalideException
SoldeNegatifException
ConfigurationTarifaireManquanteException
```

Mapping HTTP :

```text
400 = validation métier
401 = non authentifié
403 = interdit
404 = absent
409 = conflit métier
```

---

# 49. Contrat d'erreur API

Format DRF standard :

```json
{
  "field": [
    "message"
  ]
}
```

Pour les erreurs globales :

```json
{
  "detail": "Action impossible : état financier incompatible."
}
```

Les messages ne doivent pas exposer de stack trace.

---

# 50. Validation serveur

Le serveur est la source de vérité.

Valider :

* types ;
* FK ;
* unicités ;
* montants ;
* états ;
* transitions ;
* cohérence tarifaire ;
* bourses ;
* chevauchements ;
* imputations ;
* permissions ;
* périmètre utilisateur.

---

# 51. Transitions financières

Une échéance :

```text
A_PAYER
    ↓
PARTIELLEMENT_PAYE
    ↓
PAYE
```

Une échéance `PAYE` ne peut pas être directement modifiée en `A_PAYER`.

Toute correction doit passer par une opération financière explicitement autorisée et auditée.

---

# 52. Frontend

Le frontend doit respecter :

```text
API = source de vérité
```

Les validations Zod sont destinées à l'ergonomie.

Elles ne remplacent jamais les validations backend.

Pages :

```text
Modalités de paiement
Types de frais
Frais applicables
Échéances
Bourses
Situations de paiement
Fiches de scolarité
```

---

# 53. Frontend — paiements

Le frontend ne doit pas permettre :

```text
montant payé > montant restant
```

mais le backend doit également contrôler cette règle.

Le formulaire de paiement doit afficher :

```text
montant dû
déjà payé
reste
montant du nouveau paiement
```

---

# 54. Frontend — bourse

Le formulaire doit permettre :

```text
Pourcentage
OU
Montant fixe
```

Jamais les deux.

Validation :

```text
0..100 %
```

ou :

```text
montant >= 0
```

---

# 55. Frontend — situation

Afficher :

```text
Total brut
Bourse
Total net
Total payé
Reste
```

et :

```text
Échéances
Historique des imputations
```

---

# 56. Seed

Aucun seed financier réel obligatoire.

Les données financières réelles appartiennent à l'établissement.

Commandes optionnelles :

```bash
python manage.py create_sample_scolarite
```

et :

```bash
python manage.py validate_scolarite_coherence
```

La seconde commande doit détecter :

```text
échéances incohérentes
imputations > montant
bourses invalides
montants négatifs
doublons
reste incohérent
```

---

# 57. Tests modèles

Tester :

```text
unicité
contraintes
montants
FK
bourses
échéances
```

---

# 58. Tests échéancier

Scénarios obligatoires :

### A

```text
création inscription
→ échéance 0
→ échéances 1..N
```

### B

```text
appel génération ×2
→ aucune duplication
```

### C

```text
configuration tarifaire absente
→ erreur métier
→ rollback
```

### D

```text
frais annexes
→ intégrés correctement
```

---

# 59. Tests paiement

Obligatoires :

```text
paiement complet
paiement partiel
plusieurs paiements
FIFO
paiement sur plusieurs échéances
paiement concurrent
paiement impossible
échéance déjà payée
```

---

# 60. Tests trop-perçu

Tester :

```text
dette = 500 000
paiement = 600 000
```

Le système ne doit pas :

```text
mettre montant_paye = 600 000
```

sur une échéance de 500 000.

Le surplus doit suivre le contrat crédit/Trésorerie ou être refusé proprement.

---

# 61. Tests bourses

Tester :

```text
100 %
50 %
montant fixe
0 %
100 %
montant fixe supérieur à la dette
bourse chevauchante
bourse expirée
bourse après paiement
```

---

# 62. Tests situation

Tester :

```text
aucun paiement
paiement partiel
paiement complet
bourse partielle
bourse totale
plusieurs échéances
plusieurs inscriptions
```

---

# 63. Tests d'intégrité

Créer :

```text
test_integrite_scolarite
```

Il doit reproduire les assertions du SQL de référence.

Toute divergence doit être documentée.

---

# 64. Tests RBAC

Tester chaque endpoint avec :

```text
DIRECTION
COMPTABLE
SCOLARITE
LECTURE
utilisateur non authentifié
```

Matrice minimale :

| Action         | DIRECTION | COMPTABLE | SCOLARITE | LECTURE |
| -------------- | --------: | --------: | --------: | ------: |
| Lire           |         ✓ |         ✓ |         ✓ |       ✓ |
| Modifier tarif |         ✓ |         ✓ |         ✗ |       ✗ |
| Payer          |         ✓ |         ✓ |         ✓ |       ✗ |
| Bourse         |         ✓ |         ✗ |         ✗ |       ✗ |
| Générer fiche  |         ✓ |         ✗ |         ✓ |       ✗ |

---

# 65. Tests audit

Vérifier qu'une opération financière produit bien :

```text
JournalAudit
```

avec :

```text
auteur
action
objet
avant/après
```

---

# 66. OpenAPI

Toutes les routes doivent être documentées.

Utiliser :

```python
@extend_schema(...)
```

lorsque nécessaire.

La génération :

```bash
python manage.py spectacular
```

doit produire :

```text
0 Error
```

---

# 67. Performance

Les listes doivent éviter les N+1 queries.

Utiliser :

```text
select_related()
prefetch_related()
```

pour les relations appropriées.

Les situations financières doivent utiliser des agrégations SQL efficaces.

Aucune boucle Python ne doit recalculer individuellement les paiements de centaines d'inscriptions.

---

# 68. Index

Créer les index nécessaires notamment sur :

```text
Echeance.inscription_id
Echeance.date_echeance
Echeance.statut
Bourse.etudiant_id
Bourse.annee_scolaire_id
ImputationPaiement.echeance_id
ImputationPaiement.encaissement_id
```

Les index doivent rester cohérents avec le SQL de référence.

---

# 69. Concurrence

Les opérations financières doivent être sûres contre :

```text
double paiement
double génération
double attribution bourse
```

Les opérations sensibles doivent utiliser les verrous DB appropriés.

---

# 70. Migration

Créer les migrations Django nécessaires.

Avant livraison :

```bash
python manage.py makemigrations --check --dry-run
```

doit être propre.

La migration doit être compatible avec les migrations existantes.

---

# 71. Non-régression

La Phase 4 ne doit pas casser :

```text
Phase 1
Phase 2
Phase 3
Phase 3B
```

Tous les tests existants doivent continuer à passer.

---

# 72. Portes de validation backend

Obligatoire :

```bash
ruff check .
python manage.py check
python manage.py makemigrations --check --dry-run
pytest -q
python manage.py spectacular --file /tmp/schema.yml
```

Résultat attendu :

```text
0 erreur critique
```

---

# 73. Portes de validation frontend

Obligatoire :

```bash
npm run typecheck
npm test
npm run build
```

---

# 74. Scénarios E2E obligatoires

## Scénario 1 — inscription

```text
Créer étudiant
    ↓
Créer inscription
    ↓
Générer échéancier
    ↓
Vérifier échéance 0
    ↓
Vérifier échéances suivantes
```

## Scénario 2 — paiement partiel

```text
Dette = 1 000 000
Paiement = 300 000
Reste = 700 000
```

## Scénario 3 — paiement complet

```text
Paiement supplémentaire = 700 000
Reste = 0
Statut = PAYE
```

## Scénario 4 — bourse

```text
Dette = 1 000 000
Bourse = 50 %
Dette nette = 500 000
```

## Scénario 5 — FIFO

```text
E0 = 300 000
E1 = 400 000
E2 = 500 000

Paiement = 600 000

E0 = 300 000 payé
E1 = 300 000 payé
E1 reste 100 000
E2 reste 500 000
```

---

# 75. Critères de sortie Phase 4

La phase n'est terminée que si :

1. les migrations passent ;
2. les modèles sont conformes ;
3. les contraintes DB sont présentes ;
4. les services métier existent ;
5. les transactions sont correctement utilisées ;
6. les échéanciers sont idempotents ;
7. les paiements sont traçables par imputation ;
8. le FIFO fonctionne ;
9. les bourses sont traçables ;
10. le reste à payer est correct ;
11. aucune somme financière n'utilise `float` ;
12. les trop-perçus sont explicitement traités ;
13. le RBAC est testé ;
14. l'audit est testé ;
15. OpenAPI est valide ;
16. les tests backend passent ;
17. les tests frontend passent ;
18. le build frontend passe ;
19. aucune régression des phases 1–3 n'est détectée ;
20. les workflows E2E passent.

---

# 76. Interdictions absolues pour l'agent

L'agent ne doit pas :

* créer un deuxième système d'authentification ;
* créer un deuxième système RBAC ;
* dupliquer les modèles existants ;
* utiliser des floats ;
* modifier directement `montant_paye` depuis un endpoint générique ;
* créer deux échéanciers pour une même inscription ;
* permettre une imputation supérieure au montant disponible ;
* permettre une bourse supérieure à la dette couverte ;
* modifier silencieusement les anciennes échéances lorsqu'une grille tarifaire change ;
* contourner `transaction.atomic()` pour les opérations financières ;
* supprimer une opération financière historique sans audit ;
* considérer les permissions frontend comme une sécurité ;
* inventer des données académiques futures ;
* créer une implémentation fictive du module Trésorerie ;
* contourner le SQL de référence sans justification ;
* désactiver ou supprimer les tests existants pour faire passer la suite.

---

# 77. Ordre d'implémentation imposé

L'agent doit implémenter dans cet ordre :

```text
1. Audit du dépôt
        ↓
2. Vérification SQL / migrations
        ↓
3. Modèles
        ↓
4. Migrations
        ↓
5. Contraintes DB
        ↓
6. Services financiers
        ↓
7. ImputationPaiement
        ↓
8. Bourses / allocations
        ↓
9. Situation financière
        ↓
10. Serializers
        ↓
11. Permissions
        ↓
12. ViewSets / actions
        ↓
13. URLs
        ↓
14. OpenAPI
        ↓
15. Tests backend
        ↓
16. Frontend
        ↓
17. Tests frontend
        ↓
18. Tests E2E
        ↓
19. Audit final
        ↓
20. Rapport de livraison
```

---

# 78. Rapport obligatoire de fin d'implémentation

L'agent doit produire :

```text
PHASE_4_IMPLEMENTATION_REPORT.md
```

avec :

### A. Fichiers créés

### B. Fichiers modifiés

### C. Migrations

### D. Modèles

### E. Services métier

### F. APIs

### G. Permissions

### H. Audit

### I. Tests

### J. Résultats des tests

### K. Éventuelles divergences avec le SQL de référence

### L. Dette technique restante

### M. Points volontairement reportés à Phase 5+

---

# 79. Définition finale du "Done"

La Phase 4 est considérée comme **DONE** uniquement lorsque :

```text
SQL conforme
     +
ORM conforme
     +
Services transactionnels
     +
Imputation traçable
     +
Bourses traçables
     +
Situation financière exacte
     +
API sécurisée
     +
RBAC serveur
     +
Audit
     +
OpenAPI
     +
Types TS
     +
Frontend
     +
Tests backend
     +
Tests frontend
     +
E2E
     +
Aucune régression
```

sont tous validés.

**Aucun "TODO" critique ne doit rester dans les workflows financiers.**

Les éléments dépendant des phases futures doivent être explicitement identifiés comme interfaces/dépendances et non comme fonctionnalités prétendument terminées.

---

# 80. Résumé architectural

La Phase 4 finale repose sur le modèle :

```text
                 ┌───────────────────┐
                 │   REFERENTIEL     │
                 │ Niveau / Année    │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ TARIFICATION      │
                 │ ModalitePaiement  │
                 │ FraisApplicable   │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │    INSCRIPTION    │
                 └─────────┬─────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │    ECHEANCES      │
                 │ 0, 1, 2 ... N     │
                 └──────┬─────┬──────┘
                        │     │
             ┌──────────┘     └──────────┐
             ▼                           ▼
       ┌───────────┐             ┌──────────────┐
       │  BOURSE   │             │ IMPUTATIONS  │
       │allocation │             │  paiements   │
       └─────┬─────┘             └──────┬───────┘
             │                          │
             └──────────┬───────────────┘
                        ▼
              ┌────────────────────┐
              │ SITUATION FINANCIÈRE│
              │                    │
              │ total brut         │
              │ bourses            │
              │ total net          │
              │ payé               │
              │ reste              │
              └─────────┬──────────┘
                        │
             ┌──────────┴───────────┐
             ▼                      ▼
      ┌──────────────┐       ┌───────────────┐
      │ API / DRF    │       │ FICHE SCOLARITÉ│
      └──────────────┘       └───────────────┘
```

Cette architecture doit rester la référence pendant toute l'implémentation.

**Fin de la spécification Phase 4 v2.**
