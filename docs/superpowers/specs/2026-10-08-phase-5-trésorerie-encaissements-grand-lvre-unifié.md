# Phase 5 — Trésorerie, Encaissements & Grand Livre Unifié

**Date :** 2026-10-08
**Version :** 2.1
**Statut :** SPÉCIFICATION FINALE — PRÊTE POUR IMPLÉMENTATION
**Priorité :** Haute

---

## 0. Directive générale à l'agent de code

Cette phase doit être implémentée **dans le dépôt existant**, sans réécrire, dupliquer ni dégrader les phases précédentes.

Avant toute modification, l'agent doit :

1. analyser l'architecture existante ;
2. auditer les modèles, migrations, serializers, ViewSets, permissions, services, URLs, tests et conventions ;
3. rechercher les implémentations existantes de `Compte`, `Mouvement`, `Encaissement`, `ImputationPaiement`, `Echeance`, `FraisInscription`, `Bourse`, etc. ;
4. réutiliser les abstractions existantes lorsqu'elles correspondent au besoin ;
5. ne jamais créer une seconde implémentation d'une fonctionnalité déjà existante ;
6. respecter le SQL de référence ;
7. respecter les conventions ORM `D-ORM-*` ;
8. respecter les conventions DRF/OpenAPI ;
9. respecter le RBAC serveur ;
10. utiliser exclusivement `Decimal` pour les montants ;
11. utiliser `DECIMAL(12,0)` côté SQL sauf convention de schéma déjà imposée ;
12. ne jamais utiliser `float` pour un montant financier ;
13. placer les règles métier dans des services transactionnels ;
14. ne pas placer les règles financières critiques dans les serializers, ViewSets ou composants frontend ;
15. considérer le frontend uniquement comme une couche UX ;
16. tester chaque règle métier ;
17. ne pas inventer de comportement non défini ;
18. utiliser des interfaces/ports pour les dépendances futures ;
19. préserver la compatibilité des phases 1 à 4 ;
20. documenter toute divergence nécessaire avec le SQL ou le code existant.

### Hiérarchie des sources

```text
SQL / migrations de référence
        ↓
migrations Django
        ↓
modèles ORM
        ↓
présente spécification
        ↓
services métier
        ↓
DRF / OpenAPI
        ↓
TypeScript
        ↓
Frontend
```

---

# 1. Objectif

La Phase 5 implémente la **trésorerie opérationnelle** du groupe scolaire.

Elle couvre :

* comptes ;
* caisses ;
* banques ;
* mobile money ;
* comptes virtuels ;
* catégories de mouvements ;
* grand livre unifié ;
* virements internes ;
* encaissements ;
* imputations ;
* dépenses ;
* arrêtés de caisse ;
* billetage ;
* audit ;
* RBAC ;
* dashboard opérationnel ;
* tests backend/frontend/E2E.

Architecture cible :

```text
DB
 ↓
Django ORM
 ↓
Services métier transactionnels
 ↓
DRF
 ↓
OpenAPI
 ↓
TypeScript
 ↓
Frontend
```

Le principe central est :

```text
Opération métier
       ↓
Service transactionnel
       ↓
Mouvement
       ↓
Grand livre
       ↓
Solde dérivé
```

---

# 2. Contrat avec la Phase 4

La séparation fonctionnelle est obligatoire.

### Phase 4 — Facturation

```text
Inscription
Echeance
FraisInscription
Bourse
BourseImputation
Reste dû
```

### Phase 5 — Trésorerie

```text
Encaissement
Imputation de l'encaissement
Mouvement
Compte
Virement
Depense
ArreteCaisse
Billetage
```

La Phase 5 ne doit pas recalculer une seconde version indépendante du reste dû.

Elle doit consommer le contrat métier fourni par la Phase 4.

### Attention aux imputations existantes

Avant de créer `ImputationEncaissement`, l'agent doit rechercher dans le dépôt :

```text
ImputationPaiement
ImputationEncaissement
PaymentAllocation
AllocationPaiement
```

ou toute abstraction équivalente.

Si un modèle existant couvre déjà le besoin, il doit être réutilisé ou adapté.

**Interdiction : deux modèles représentant la même relation financière.**

---

# 3. Périmètre

## Inclus

### Trésorerie

* comptes ;
* catégories ;
* mouvements ;
* virements ;
* encaissements ;
* imputations ;
* dépenses ;
* arrêtés ;
* billetage ;
* audit ;
* dashboard.

### API

Base :

```text
/api/v1/tresorerie/
```

Support :

* pagination ;
* filtres ;
* recherche ;
* ordering ;
* validation DRF ;
* OpenAPI ;
* RBAC.

### Frontend

* dashboard ;
* comptes ;
* catégories ;
* grand livre ;
* encaissements ;
* imputations ;
* dépenses ;
* virements ;
* arrêtés ;
* billetage.

---

# 4. Hors périmètre

Ne pas implémenter :

* comptabilité générale OHADA ;
* plan comptable général ;
* bilan comptable ;
* compte de résultat réglementaire ;
* immobilisations ;
* amortissements ;
* fiscalité ;
* TVA ;
* consolidation ;
* multi-devise ;
* prélèvement automatique ;
* passerelles de paiement ;
* banque en ligne ;
* rapprochement bancaire automatisé ;
* budget avancé ;
* reporting réglementaire ;
* titres ;
* effets de commerce.

Un dashboard de trésorerie est autorisé.

Il ne doit cependant pas être présenté comme un état comptable réglementaire.

---

# 5. Principes financiers

## 5.1 Monnaie

Monnaie :

```text
FCFA
```

Django :

```python
DecimalField(max_digits=12, decimal_places=0)
```

Python :

```python
Decimal
```

Interdit :

```python
float
```

---

## 5.2 Source de vérité

`Mouvement` constitue le grand livre unifié et la source de vérité des flux de trésorerie.

Solde :

```text
solde =
    solde_initial
    + somme(CREDIT)
    - somme(DEBIT)
```

Aucun solde courant redondant ne doit être introduit sans justification explicite.

---

## 5.3 Mouvements immuables

Un mouvement financier finalisé n'est pas librement modifiable.

L'API publique ne doit pas permettre :

```text
PUT /mouvements/{id}
PATCH /mouvements/{id}
DELETE /mouvements/{id}
```

pour modifier arbitrairement un mouvement.

La correction se fait par :

```text
annulation
ou
régularisation
```

avec mouvement inverse et audit.

---

# 6. `Compte`

```text
Compte
------
id
groupe_scolaire_id
code
libelle
type
numero_bancaire
banque
solde_initial
actif
cree_par
modifie_par
date_creation
date_modification
```

Types :

```text
CAISSE
BANQUE
MOBILE_MONEY
VIRTUEL
```

Contraintes :

```text
code unique dans le groupe
solde_initial >= 0
type valide
```

Un compte inactif :

* reste consultable ;
* ne reçoit plus de nouvelles opérations ;
* ne peut plus être sélectionné pour une opération.

Un compte ayant des mouvements ne doit pas être supprimé physiquement.

---

# 7. `CategorieMouvement`

```text
CategorieMouvement
------------------
id
code
libelle
sens
date_creation
date_modification
```

Sens :

```text
ENTREE
SORTIE
NEUTRE
```

Une catégorie `SORTIE` ne peut pas être utilisée pour un encaissement.

Une catégorie `ENTREE` ne peut pas être utilisée pour une dépense.

---

# 8. `Mouvement`

```text
Mouvement
---------
id
compte_id
date_operation
sens
montant
categorie_mouvement_id
libelle
piece_reference
ecole_id
annee_scolaire_id
virement_id
valide
cree_par
modifie_par
date_creation
date_modification
```

Contraintes :

```text
montant > 0
sens IN (DEBIT, CREDIT)
```

Indexes :

```text
(compte_id, date_operation)
(annee_scolaire_id, ecole_id, date_operation)
(categorie_mouvement_id, date_operation)
(virement_id)
```

Un mouvement doit être traçable jusqu'à son opération génératrice :

```text
Encaissement
Depense
Virement
Régularisation
```

---

# 9. `Virement`

```text
Virement
--------
id
compte_source_id
compte_destination_id
montant
date
motif
statut
cree_par
valide_par
modifie_par
date_creation
date_modification
```

Contraintes :

```text
montant > 0
source != destination
```

Les deux comptes doivent appartenir au même groupe.

Statuts :

```text
BROUILLON
EN_ATTENTE_VALIDATION
VALIDE
ANNULE
```

Lors de l'exécution :

```text
DEBIT  source
CREDIT destination
```

Les deux mouvements sont générés dans **une seule transaction**.

---

# 10. `Encaissement`

```text
Encaissement
------------
id
inscription_id
date
montant_total
mode
compte_id
mouvement_id
recu_numero
statut
cree_par
modifie_par
date_creation
date_modification
```

Modes :

```text
ESPECES
VIREMENT
MOBILE_MONEY
CHEQUE
```

Contraintes :

```text
montant_total > 0
recu_numero UNIQUE
mouvement_id UNIQUE
```

Un encaissement est obligatoirement rattaché à une inscription annuelle.

---

# 11. Numérotation des reçus

Le numéro doit être globalement unique en base.

Exemple de format :

```text
ETB-2026-000001
```

Le format peut intégrer :

* établissement ;
* exercice ;
* compteur.

Mais la contrainte finale reste :

```text
UNIQUE(recu_numero)
```

La génération doit être concurrency-safe.

Deux transactions simultanées ne doivent jamais recevoir le même numéro.

---

# 12. Création atomique d'un encaissement

Lorsque l'imputation est connue au moment de la saisie :

```text
Encaissement
     +
Mouvement CREDIT
     +
Imputations
     +
Audit
```

doivent être créés dans une transaction unique.

Si l'imputation est différée, l'encaissement doit porter un statut explicite tel que :

```text
A_IMPUTER
```

Il ne doit pas être considéré comme complètement finalisé tant que ses allocations obligatoires ne sont pas cohérentes.

---

# 13. `ImputationEncaissement`

```text
ImputationEncaissement
----------------------
id
encaissement_id
cible
echeance_id
frais_inscription_id
montant
cree_par
date_creation
date_modification
```

Cible :

```text
ECHEANCE
FRAIS
```

Invariant :

```text
ECHEANCE :
    echeance_id != NULL
    frais_inscription_id == NULL

FRAIS :
    frais_inscription_id != NULL
    echeance_id == NULL
```

Montant :

```text
montant > 0
```

Une cible peut recevoir plusieurs paiements successifs.

---

# 14. Règle FIFO

Sans ventilation explicite :

1. récupérer les échéances ouvertes ;
2. les trier dans leur ordre métier ;
3. calculer le restant dû ;
4. imputer sur la première ;
5. continuer jusqu'à épuisement du paiement.

Exemple :

```text
Paiement = 150 000

Echéance 1 = 100 000
Echéance 2 = 80 000

Résultat :

E1 = 100 000
E2 = 50 000
```

---

# 15. Frais annexes

Par défaut :

```text
Frais annexes → imputation explicite
```

Ils ne doivent pas être absorbés automatiquement par un FIFO générique si leur gestion métier exige une affectation précise.

Si le dépôt possède déjà une règle différente, elle doit être identifiée et respectée plutôt que dupliquée.

---

# 16. Surpaiement

Interdiction de perdre ou d'affecter silencieusement un excédent.

Si :

```text
paiement > créances disponibles
```

le service doit :

* rejeter l'opération ;

ou

* placer explicitement le reliquat dans un mécanisme d'avoir/crédit déjà prévu par le système.

Il ne doit jamais créer une imputation supérieure au montant restant dû.

---

# 17. Invariant d'encaissement

Pour tout encaissement finalisé :

```text
SUM(imputations.montant)
=
encaissement.montant_total
```

Cet invariant est contrôlé :

* service ;
* API ;
* tests ;
* finalisation.

Les échéances utilisées doivent être verrouillées pendant l'allocation.

---

# 18. `Depense`

```text
Depense
-------
id
date
categorie_mouvement_id
beneficiaire
designation
montant
compte_id
mouvement_id
ecole_id
annee_scolaire_id
piece_justificative
engage_par
valide_par
cree_par
modifie_par
statut
date_creation
date_modification
```

Contraintes :

```text
montant > 0
categorie.sens = SORTIE
```

Une dépense payée génère :

```text
DEBIT compte
```

Workflow :

```text
Engagement
   ↓
Validation
   ↓
Paiement
   ↓
Mouvement DEBIT
```

Ne pas inventer de seuils d'approbation non définis.

---

# 19. `ArreteCaisse`

```text
ArreteCaisse
------------
id
compte_id
date
solde_theorique
solde_physique
ecart
fait_par
valide_par
cree_par
modifie_par
statut
date_creation
date_modification
```

Contraintes :

```text
compte.type = CAISSE
solde_theorique >= 0
solde_physique >= 0
UNIQUE(compte_id, date)
```

Calcul :

```text
ecart = solde_physique - solde_theorique
```

Le solde théorique est calculé à partir du grand livre.

---

# 20. Séparation des fonctions

Lorsque le workflow le permet :

```text
fait_par != valide_par
```

La personne responsable de la caisse ne doit pas valider seule son propre arrêté lorsqu'un second rôle est disponible.

Même principe pour :

```text
engagement
validation
virement
```

---

# 21. `Billetage`

```text
Billetage
---------
id
arrete_caisse_id
denomination
quantite
montant
date_creation
date_modification
```

Contraintes :

```text
denomination > 0
quantite >= 0
UNIQUE(arrete_caisse_id, denomination)
```

Calcul :

```text
montant = denomination × quantite
```

Invariant :

```text
SUM(billetage.montant)
=
solde_physique
```

Un arrêté ne peut pas être validé si cet invariant est faux.

---

# 22. Workflow encaissement

```text
1. Identifier l'inscription
2. Obtenir le reste dû via Phase 4
3. Saisir le montant
4. Choisir le mode
5. Choisir le compte
6. Générer le numéro de reçu
7. Créer l'encaissement
8. Générer le CREDIT
9. Appliquer FIFO ou ventilation manuelle
10. Vérifier total imputé = montant
11. Auditer
12. Finaliser
13. Générer le reçu
```

---

# 23. Workflow dépense

```text
1. Saisir
2. Vérifier catégorie SORTIE
3. Vérifier compte actif
4. Vérifier disponibilité
5. Engager
6. Valider
7. Générer DEBIT
8. Auditer
9. Marquer payée
```

---

# 24. Workflow virement

```text
1. Choisir source
2. Choisir destination
3. Vérifier source != destination
4. Vérifier comptes actifs
5. Vérifier disponibilité
6. Engager
7. Valider
8. DEBIT source
9. CREDIT destination
10. Auditer
```

Les étapes 8 et 9 sont atomiques.

---

# 25. Workflow arrêté de caisse

```text
1. Fermer la caisse
2. Calculer solde théorique
3. Saisir billetage
4. Calculer solde physique
5. Vérifier billetage
6. Calculer écart
7. Enregistrer
8. Faire valider
9. Justifier les écarts
10. Régulariser uniquement via opération traçable
```

---

# 26. Services métier

Organisation recommandée :

```text
tresorerie/services/
    compte.py
    categorie_mouvement.py
    mouvement.py
    virement.py
    encaissement.py
    imputation_encaissement.py
    depense.py
    arrete_caisse.py
    billetage.py
    dashboard.py
```

Fonctions minimales :

```python
calculer_solde_compte(...)
generer_mouvement_credit(...)
generer_mouvement_debit(...)
executer_virement(...)
creer_encaissement(...)
imputer_encaissement(...)
calculer_reste_du(...)
creer_depense(...)
calculer_solde_theorique_caisse(...)
creer_arrete_caisse(...)
enregistrer_billetage(...)
annuler_operation_financiere(...)
```

---

# 27. Transactions

Utiliser :

```python
transaction.atomic()
```

pour :

```text
encaissement
encaissement + imputation
dépense
virement
arrêté + billetage
annulation/régularisation
```

Utiliser :

```python
select_for_update()
```

lorsqu'une ressource financière peut être modifiée simultanément.

---

# 28. Idempotence

Les opérations sensibles doivent être protégées contre les doubles soumissions :

```text
double clic
retry HTTP
timeout
retry réseau
```

Une opération métier ne doit jamais créer deux mouvements.

Lorsque l'infrastructure le permet, utiliser une clé d'idempotence.

---

# 29. Concurrence

Cas obligatoires :

### Deux paiements simultanés

Le total des allocations ne doit jamais dépasser le reste dû.

### Deux virements simultanés

Le solde disponible doit être contrôlé sous verrou.

### Deux reçus simultanés

Les numéros doivent rester uniques.

### Deux arrêtés

Impossible d'avoir deux arrêtés pour :

```text
même compte
même date
```

---

# 30. Annulation et régularisation

Une opération financière finalisée n'est pas supprimée.

Correction :

```text
opération originale
       ↓
annulation/régularisation
       ↓
mouvement inverse
       ↓
audit
```

L'historique reste conservé.

---

# 31. API

Base :

```text
/api/v1/tresorerie/
```

### Comptes

```text
GET    /comptes/
POST   /comptes/
GET    /comptes/{id}/
PATCH  /comptes/{id}/
DELETE /comptes/{id}/
GET    /comptes/{id}/mouvements/
```

### Catégories

```text
GET    /categories-mouvement/
POST   /categories-mouvement/
GET    /categories-mouvement/{id}/
PATCH  /categories-mouvement/{id}/
DELETE /categories-mouvement/{id}/
```

### Mouvements

```text
GET /mouvements/
GET /mouvements/{id}/
GET /mouvements/{id}/piece/
```

Lecture seule.

### Virements

```text
GET  /virements/
POST /virements/
GET  /virements/{id}/
POST /virements/{id}/valider/
POST /virements/{id}/annuler/
```

### Encaissements

```text
GET  /encaissements/
POST /encaissements/
GET  /encaissements/{id}/
GET  /encaissements/{id}/recu/
POST /encaissements/{id}/imputer/
POST /encaissements/{id}/annuler/
```

### Imputations

```text
GET /imputations-encaissement/
GET /imputations-encaissement/{id}/
```

Lecture seule dans l'API générique.

### Dépenses

```text
GET  /depenses/
POST /depenses/
GET  /depenses/{id}/
POST /depenses/{id}/valider/
POST /depenses/{id}/annuler/
```

### Arrêtés

```text
GET  /arretes-caisse/
POST /arretes-caisse/
GET  /arretes-caisse/{id}/
POST /arretes-caisse/{id}/billetage/
POST /arretes-caisse/{id}/valider/
```

### Dashboard

```text
GET /tableau-de-bord/solde/
GET /tableau-de-bord/flux/
GET /tableau-de-bord/alertes/
```

Les noms exacts doivent respecter les conventions déjà utilisées dans le projet.

---

# 32. Filtres

Selon les ressources :

```text
date_min
date_max
compte
type_compte
categorie
ecole
annee_scolaire
mode
statut
inscription
```

Grand livre :

```text
compte
date
sens
catégorie
école
année
référence
```

Pagination, recherche et ordering suivent les conventions DRF existantes.

---

# 33. RBAC

Lecture selon le RBAC existant :

```text
COMPTABLE
DAF
DIRECTION
SCOLARITE
```

Écriture selon contexte :

```text
COMPTABLE
DAF
DIRECTION
```

Validation selon workflow :

```text
DAF
DIRECTION
COMPTABLE
```

Le rôle :

```text
LECTURE
```

ne peut jamais écrire.

Les permissions sont vérifiées côté serveur.

---

# 34. Audit

Auditer :

```text
création/modification/désactivation compte
création/modification/désactivation catégorie
création virement
validation virement
annulation virement
création encaissement
imputation
annulation encaissement
création dépense
validation dépense
annulation dépense
création arrêté
validation arrêté
billetage
régularisation
```

Minimum :

```text
utilisateur
action
table_cible
objet_id
timestamp
snapshot_avant
snapshot_apres
```

Ne jamais journaliser :

```text
password
token
secret
```

---

# 35. Frontend

Pages :

```text
Dashboard
Comptes
Catégories
Grand livre
Encaissements
Imputations
Dépenses
Virements
Arrêtés
Billetage
```

Le frontend doit afficher :

* chargement ;
* erreur ;
* état vide ;
* succès ;
* validation ;
* confirmation d'action sensible.

API = source de vérité.

Zod ou équivalent = UX uniquement.

---

# 36. Dashboard

Afficher :

```text
solde par compte
solde par type
entrées
sorties
flux net
écarts de caisse
encaissements récents
dépenses récentes
```

Peuvent être ajoutés :

* graphique 6 mois ;
* alertes ;
* prévision simple.

Mais aucun état ne doit être présenté comme un bilan comptable.

---

# 37. Reçus

Le reçu doit être généré uniquement à partir d'un encaissement réellement enregistré.

Il contient selon les données disponibles :

```text
établissement
étudiant
inscription
date
montant
mode
numéro de reçu
ventilation
opérateur
```

Un reçu d'un encaissement annulé doit être identifiable comme tel.

---

# 38. Tests modèles

Tester :

* unicité ;
* CHECK ;
* FK ;
* montants ;
* compte actif/inactif ;
* catégorie ;
* cible d'imputation ;
* billetage ;
* unicité compte/date ;
* suppression interdite des objets financiers utilisés.

---

# 39. Tests services

Obligatoires :

* calcul solde ;
* encaissement ;
* mouvement CREDIT ;
* FIFO ;
* paiement partiel ;
* surpaiement ;
* dépense ;
* mouvement DEBIT ;
* virement double mouvement ;
* disponibilité ;
* atomicité ;
* idempotence ;
* arrêté ;
* billetage ;
* séparation des fonctions ;
* annulation ;
* audit ;
* concurrence.

---

# 40. Tests API

Tester :

* authentification ;
* RBAC ;
* permissions objet ;
* validations ;
* pagination ;
* filtres ;
* ordering ;
* recherche ;
* erreurs métier ;
* validation ;
* annulation ;
* reçu ;
* OpenAPI.

---

# 41. Tests E2E

## Encaissement

```text
Créer compte
→ inscription
→ encaisser
→ CREDIT
→ solde
→ imputation
→ reçu
```

## FIFO

```text
E1 = 100 000
E2 = 80 000
Paiement = 150 000

E1 = 100 000
E2 = 50 000
```

## Virement

```text
A = 500 000
B = 100 000
Virement = 200 000

A = 300 000
B = 300 000
```

## Dépense

```text
500 000
→ dépense 100 000
→ solde 400 000
```

## Caisse

```text
Théorique = 250 000
Billetage = 250 000
Ecart = 0
```

## Caisse avec écart

```text
Théorique = 250 000
Physique = 240 000
Ecart = -10 000
```

---

# 42. Tests transactionnels

Provoquer une erreur au milieu de :

```text
encaissement
imputation
dépense
virement
arrêté
```

et vérifier :

```text
rollback complet
aucun mouvement orphelin
aucune imputation orpheline
aucun objet partiellement finalisé
```

---

# 43. Performance

Index principaux :

```text
(compte_id, date_operation)
(annee_scolaire_id, ecole_id, date_operation)
(categorie_mouvement_id, date_operation)
(virement_id)
```

Éviter :

* N+1 ;
* agrégations répétées ;
* jointures qui doublent les montants.

Les performances doivent être mesurées sur les données représentatives du projet.

---

# 44. Périodes financières

La convention de l'établissement est :

```text
septembre → août
```

lorsqu'elle correspond au modèle existant.

Les opérations d'une période clôturée ne doivent pas être modifiées silencieusement.

Une correction passe par :

```text
régularisation
```

La clôture comptable générale reste hors périmètre.

---

# 45. Migration

Avant modification :

```text
audit migrations
audit tables
audit FK
audit index
audit données
audit Phase 4
```

Aucune migration ne doit casser les phases précédentes.

Les données existantes doivent être migrées explicitement si nécessaire.

---

# 46. Architecture Django/DRF

Respecter la structure du dépôt.

Organisation indicative :

```text
apps/tresorerie/
    models/
    serializers/
    views/
    services/
    permissions/
    filters/
    urls/
    admin/
    tests/
```

Principe :

```text
Model
 ↓
Service métier
 ↓
Serializer / ViewSet
 ↓
API
```

Les serializers ne doivent pas porter les workflows financiers complexes.

---

# 47. OpenAPI

Toutes les routes doivent documenter :

* paramètres ;
* request body ;
* réponses ;
* erreurs ;
* permissions ;
* actions métier.

Les types TypeScript doivent être dérivés du contrat OpenAPI lorsque le projet utilise cette génération.

---

# 48. Erreurs métier

Codes recommandés :

```text
COMPTE_INACTIF
SOLDE_INSUFFISANT
COMPTE_SOURCE_DESTINATION_IDENTIQUES
MONTANT_INVALIDE
ECHEANCE_DEJA_SOLDEE
IMPUTATION_SUPERIEURE_AU_RESTANT
ENCAISSEMENT_NON_IMPUTE
SURPAIEMENT_INTERDIT
RECU_DEJA_UTILISE
ARRETE_DEJA_EXISTANT
BILLETAGE_INCOHERENT
VALIDATION_INTERDITE
OPERATION_DEJA_ANNULEE
```

Ils doivent être adaptés aux conventions d'erreur déjà présentes.

---

# 49. Critères d'acceptation finale

La phase est terminée uniquement si :

1. migrations valides ;
2. schéma cohérent ;
3. aucun doublon avec les phases précédentes ;
4. contrat Phase 4/5 validé ;
5. `Decimal` partout ;
6. aucun `float` financier ;
7. grand livre unifié fonctionnel ;
8. soldes corrects ;
9. encaissements fonctionnels ;
10. imputations correctes ;
11. FIFO correct ;
12. surpaiement explicitement traité ;
13. dépenses fonctionnelles ;
14. virements atomiques ;
15. concurrence protégée ;
16. idempotence protégée ;
17. reçus uniques ;
18. mouvements immuables ;
19. annulations traçables ;
20. arrêtés cohérents ;
21. billetage cohérent ;
22. séparation des fonctions ;
23. RBAC ;
24. audit ;
25. OpenAPI ;
26. frontend ;
27. tests unitaires ;
28. tests intégration ;
29. tests E2E ;
30. tests de non-régression ;
31. aucune suppression financière silencieuse ;
32. documentation mise à jour.

---

# 50. Ordre obligatoire d'implémentation

```text
1. Audit du dépôt
2. Audit SQL/migrations
3. Audit Phase 4
4. Audit des modèles d'imputation existants
5. Modèles
6. Migrations
7. Contraintes DB
8. Services
9. Transactions
10. Verrous
11. Tests services
12. Serializers
13. Permissions
14. ViewSets
15. Actions métier
16. URLs
17. OpenAPI
18. Tests API
19. Types TypeScript
20. Services frontend
21. Pages frontend
22. Tests frontend
23. E2E
24. Audit sécurité
25. Audit concurrence
26. Audit performance
27. Non-régression
28. Documentation
```

---

# 51. Interdictions absolues

L'agent ne doit pas :

* créer un second calcul du reste dû ;
* créer un second modèle d'imputation identique ;
* modifier directement les soldes sans mouvement ;
* exposer des mouvements manuels arbitraires ;
* utiliser `float` ;
* contourner le RBAC ;
* considérer le frontend comme sécurité ;
* supprimer une opération financière finalisée ;
* générer deux mouvements pour une opération ;
* dépasser le reste dû ;
* perdre un reliquat ;
* générer deux reçus identiques ;
* effectuer un virement partiellement ;
* accepter un billetage incohérent ;
* inventer des seuils d'approbation ;
* introduire une comptabilité générale incomplète ;
* modifier silencieusement les données historiques.

---

# 52. Architecture fonctionnelle finale

```text
                         ┌──────────────────────┐
                         │      PHASE 4         │
                         │ Facturation/Créances │
                         │                      │
                         │ Inscription          │
                         │ Echeance             │
                         │ Frais                │
                         │ Bourse               │
                         └──────────┬───────────┘
                                    │
                              Reste dû
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     ENCAISSEMENT     │
                         │                      │
                         │ montant              │
                         │ mode                 │
                         │ compte               │
                         │ reçu                 │
                         └──────────┬───────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     ▼                             ▼
              IMPUTATIONS                    CREDIT
                     │                             │
                     ▼                             ▼
          Echeance / Frais                  MOUVEMENT
                                                   │
                                                   ▼
                                           GRAND LIVRE
                                                   │
                  ┌────────────────────────────────┼─────────────────┐
                  │                                │                 │
                  ▼                                ▼                 ▼
               DEPENSE                         VIREMENT         ENCAISSEMENT
                  │                                │                 │
                  ▼                                ▼                 ▼
                DEBIT                       DEBIT + CREDIT         CREDIT
                  │                                │                 │
                  └────────────────────────────────┼─────────────────┘
                                                   ▼
                                             SOLDE COMPTE
                                                   │
                                                   ▼
                                           ARRETE DE CAISSE
                                                   │
                                      ┌────────────┴────────────┐
                                      ▼                         ▼
                                THEORIQUE                   PHYSIQUE
                                                                  │
                                                                  ▼
                                                              BILLETAGE
                                                                  │
                                                                  ▼
                                                                 ECART
```

**Résultat attendu :**

La Phase 5 doit fournir une trésorerie opérationnelle **fiable, transactionnelle, auditable, concurrency-safe et intégrée à la facturation de la Phase 4**, sans introduire prématurément une comptabilité générale.
