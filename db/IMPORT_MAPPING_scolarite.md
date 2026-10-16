# Mapping d'import legacy — groupe « scolarite » (§16 Phase 10)

Source : `test 2026.xlsx`, feuilles `ESSIG`, `ESSS`, `CFPA`, `recherche Essig`,
`Recherche CFPA`, `Recherche UPSS`, `unforme`, `frais des copies`.

Référence structurelle : `db/CORRESPONDANCE.md`. Modèles cibles :
`personnes.models.Etudiant`/`Inscription`, `scolarite.models.Echeance`/
`FraisInscription`/`TypeFrais`/`ModalitePaiement`, `tresorerie.models.Encaissement`/
`ImputationEncaissement`.

**Constat sur le classeur fourni** : les feuilles `ESSIG`/`ESSS`/`CFPA` de
`test 2026.xlsx` sont le **gabarit de l'année 2025-2026** — en-têtes complets,
mais corps de tableau vide (colonne `N° ordre` pré-remplie 1..N, tout le reste
à `None`/`0`). Les feuilles `recherche *` sont des formulaires de recherche
unitaire (vue détail par numéro d'ordre), pas des tables de données. Les
feuilles `unforme` et `frais des copies` ont un gabarit identique (3 blocs
ESSIG/UPSS/CFPA) avec corps vide. Le mapping ci-dessous décrit donc la
**structure** à importer dès qu'un classeur réellement rempli (années
antérieures, ou cette feuille une fois saisie) sera fourni ; l'implémenteur
doit traiter un classeur sans lignes de données comme un cas normal (0 ligne
importée, pas une erreur).

---

## 1. Feuilles `ESSIG` / `ESSS` / `CFPA` — inscriptions + échéancier + encaissements

### 1.1 Structure Excel observée

Bloc d'en-tête sur 3 lignes (ligne 1 = n° colonne indicatif, ligne 2 = libellé
de groupe, ligne 3 = sous-libellé) :

| Colonne | Libellé (ligne 2) | Sous-libellé (ligne 3) |
|---|---|---|
| A | `N° ordre` | — |
| B | `NOMS ET PRENOMS` | — |
| C | `NIVEAU` | — |
| D | `FILERES ET OPTION` | — |
| E | `TYPE DE FORMATION` (absent sur ESSS/CFPA) | — |
| F,G | `Octobre` | `Dates` / `Somme` |
| H,I | `Novembre` | `Dates` / `Somme` |
| J,K | `Décembre` | `Dates` / `Somme` |
| L,M | `Janvier` | `Dates` / `Somme` |
| N,O | `Février` | `Dates` / `Somme` |
| P,Q | `Mars` | `Dates` / `Somme` |
| R,S | `Avril` | `Dates` / `Somme` |
| T,U | `Mai` | `Dates` / `Somme` |
| V,W | `Juin` | `Dates` / `Somme` |
| X,Y | `Juillet` | `Dates` / `Somme` |
| Z,AA | `Août` | `Dates` / `Somme` |
| AB | `Total versé` | — |
| AC | `Coût de la scolarité` | — |
| AD | `Total restant` | — |
| AE | `Situation` | — |
| AF | `N° MATRICULE` | — |

(Sur `ESSS`/`CFPA`, pas de colonne `TYPE DE FORMATION` : tout décalé d'une
colonne vers la gauche à partir de `Octobre`.)

Chaque feuille correspond à une **école** (ESSIG, ESSS, CFPA — nom de la
feuille = `ecole.sigle` ou `ecole.nom`, à faire confirmer par un référentiel
`db/CORRESPONDANCE.md`-like ; prévoir un mapping manuel feuille→`ecole.id`
fourni en configuration de l'import, car aucune colonne ne porte explicitement
le sigle d'école dans le corps de tableau). Chaque ligne = un étudiant inscrit
à l'année scolaire correspondant au classeur (`test 2026.xlsx` ⇒ année
« 2025-2026 », à fixer en paramètre de l'import, pas déduite du fichier).

### 1.2 Clé naturelle d'idempotence

- **Étudiant** : `N° MATRICULE` (colonne `AF`/`AE` selon feuille) si renseigné et
  non vide → clé d'upsert sur `Etudiant.matricule`.
  - Si `N° MATRICULE` est absent/vide mais `NOMS ET PRENOMS` est rempli :
    pas de clé fiable → **ne pas créer d'étudiant**, journaliser en erreur
    (« étudiant sans matricule, ligne ignorée — à matriculer manuellement »).
    Ne jamais générer un matricule de substitution dans l'import (la génération
    de matricule est un service serveur, cf. `personnes/services.py
    generer_matricule`, réservé aux créations via l'application).
- **Inscription** : couple `(etudiant.matricule, annee_scolaire, ecole)` →
  correspond à la contrainte `unq_inscription_etudiant_annee`
  (`etudiant`, `annee_scolaire`). `numero_ordre` = colonne `N° ordre` de la
  ligne, mais **n'est pas réutilisable tel quel** comme clé d'upsert : la
  contrainte `unq_inscription_numero_ordre` est `(ecole, annee_scolaire,
  numero_ordre)`, donc on peut l'utiliser en clé secondaire pour retrouver une
  inscription déjà importée sans matricule, mais la clé primaire d'idempotence
  reste `(etudiant, annee_scolaire)`.
- **Échéance** : couple `(inscription, numero)` où `numero` = index du mois
  (0 = inscription, 1 = Octobre, 2 = Novembre, …, 11 = Août — cf. §1.4).
- **Encaissement** : pas de numéro de pièce/reçu dans le fichier Excel (aucune
  colonne « N° reçu »). Clé naturelle à défaut : `(inscription, mois, date du
  versement, montant)` — combinaison non garantie unique si deux versements
  identiques le même mois/jour/montant pour le même étudiant (cas rare mais
  possible). **Recommandation à l'implémenteur** : générer un
  `recu_numero` d'import déterministe, p. ex. `IMPORT-<annee>-<ecole>-
  <numero_ordre>-<mois_index>`, pour permettre un ré-import idempotent (upsert
  sur ce recu_numero) tout en documentant qu'il s'agit d'un numéro de reprise,
  pas d'un vrai numéro de reçu papier.

### 1.3 Résolution des FK

| Colonne Excel | FK cible | Transformation |
|---|---|---|
| (nom de la feuille) | `Ecole` | Mapping statique configuré par l'implémenteur : `ESSIG`→École ESSIG, `ESSS`→École ESSS (santé, cf. feuille santé/BM/SG/SI), `CFPA`→École CFPA. À résoudre par `Ecole.nom` ou `Ecole.sigle`, en échouant (erreur journalisée, ligne ignorée) si l'école n'existe pas encore en base plutôt que de la créer à la volée. |
| (fixe, paramètre d'import) | `AnneeScolaire` | Paramètre de la commande d'import (ex. `--annee=2025-2026`), résolu par `AnneeScolaire.libelle`. Erreur fatale (pas ligne par ligne) si l'année n'existe pas. |
| `NIVEAU` | `Niveau` | Résolution par libellé/code, **scopée à l'école** (`Niveau.ecole`) — cf. valeurs observées en légende de colonne AF/AG type `L 1`, `L 2`, `1ère Année`, `2ème Année`. Normaliser (trim, casse) avant comparaison. Si aucun `Niveau` ne correspond pour cette école : ligne en erreur journalisée (« niveau "X" inconnu pour l'école Y »), ne pas inventer de niveau. |
| `FILERES ET OPTION` | `OptionFiliere` (→ `Filiere`) | La colonne combine filière + option dans un seul texte libre (ex. `GACO/CI`, `GACO / TCM`, `SANTE / BM`). Transformation : split sur `/` → partie gauche = tentative de résolution `Filiere.sigle`/`nom`, partie droite = `OptionFiliere.sigle`/`nom` au sein de cette filière. Si le split échoue ou ne résout aucune `OptionFiliere` existante : erreur journalisée avec la valeur brute, ligne ignorée (pas de création automatique de filière/option : risque de doublons avec graphies différentes). |
| `TYPE DE FORMATION` | `ModaliteFormation` (via `Classe.modalite_formation`) | Résolution par `ModaliteFormation.code` (FI/FC/FL/FT) ou libellé. Absent sur ESSS/CFPA dans le fichier observé → défaut à documenter (ex. `FI`) en paramètre d'import, avec avertissement journalisé « type de formation absent, valeur par défaut appliquée », jamais une erreur bloquante puisque le modèle `Classe` exige ce champ. |
| (Niveau, OptionFiliere, ModaliteFormation, AnneeScolaire) | `Classe` | `Classe` est obtenue par get_or_create sur ce quadruplet (`libelle_auto` générée côté modèle). Si la combinaison n'existe pas et que les 4 composants sont résolus : créer la `Classe` (c'est le seul objet du groupe « référentiel » que cet import a besoin de créer à la volée, car une classe est une simple combinaison, pas une donnée métier sensible) ; sinon, erreur journalisée. |

### 1.4 Mapping colonnes → champs

**`Etudiant`** (upsert par `matricule`) :

| Colonne Excel | Champ Django | Transformation |
|---|---|---|
| `N° MATRICULE` | `Etudiant.matricule` | Trim ; clé d'upsert. Si vide → ligne en erreur (§1.2). |
| `NOMS ET PRENOMS` | `Etudiant.nom` + `Etudiant.prenoms` | Le fichier ne sépare pas nom/prénoms. Heuristique : premier "mot" (ou première séquence en MAJUSCULES) = `nom`, reste = `prenoms` ; **toute ligne où l'heuristique est ambiguë (un seul mot, ou aucune majuscule distinctive) doit être journalisée en avertissement avec la valeur brute**, et importée avec tout le texte dans `nom` + `prenoms` vide plutôt que de deviner et risquer une inversion silencieuse. |
| — (absent) | `sexe` | Non présent dans ces feuilles → laissé vide si le champ le permet, sinon valeur `"?"`/`None` à arbitrer ; en l'état `Sexe` n'a pas de choix "inconnu", donc **champ obligatoire non renseignable depuis cette source** → journaliser en avertissement « sexe à compléter manuellement » sans bloquer l'import (ne pas inventer M/F). |

**`Inscription`** (upsert par `(etudiant, annee_scolaire)`) :

| Colonne Excel | Champ Django | Transformation |
|---|---|---|
| `N° ordre` | `numero_ordre` | Entier direct. |
| (paramètre import) | `annee_scolaire` | Cf. §1.3. |
| (mapping feuille) | `ecole` | Cf. §1.3. |
| `NIVEAU` + `FILERES ET OPTION` + `TYPE DE FORMATION` | `classe` | Cf. §1.3 (résolution FK composée). |
| (déduit) | `type` | `NOUVEAU` si l'étudiant n'a aucune inscription antérieure en base pour une année précédente, sinon `REINSCRIPTION`. Calculé à l'import, pas lu dans le fichier (absent du fichier). |
| (déduit) | `statut` | Idem : `NOUVEAU`/`ANCIEN` déduit de la présence d'inscriptions antérieures. |
| `Coût de la scolarité` | `cout_scolarite_negocie` | Si le montant diffère du barème `ModalitePaiement` du niveau/année (`montant_total`), renseigner `cout_scolarite_negocie` avec le montant du fichier ; si égal, laisser `null` (pas de négociation). Comparaison à tolérance 0 (montants en FCFA entiers). |
| — (absent) | `date_inscription` | Champ obligatoire non présent dans le fichier → utiliser `annee_scolaire.date_debut` par défaut, avec avertissement journalisé (date approximative, pas la date réelle de dépôt de dossier). |
| — (absent) | `etat` | Défaut `ACTIVE`. Si `Situation` (colonne AE) porte une mention explicite d'abandon/exclusion (texte libre, à surveiller : valeurs comme « NON », « partiel », « OUI » observées sur d'autres feuilles pour un statut de paiement, pas de scolarité) → **ne pas réutiliser cette colonne pour `etat`**, elle documente la situation de paiement, pas la situation académique. `etat` reste `ACTIVE` par défaut, ajustable seulement par l'application ensuite. |
| — (absent) | `est_boursier`, `etablissement_provenance` | Non présents dans le fichier → `False`/`null` par défaut. |

**`Echeance`** (upsert par `(inscription, numero)`) — une ligne par mois renseigné :

| Colonne Excel | Champ Django | Transformation |
|---|---|---|
| (mois, ex. `Octobre` → `Dates`/`Somme`) | `numero` | `numero=0` réservé à l'échéance d'inscription/réinscription (alimentée depuis `ModalitePaiement.montant_inscription_reinscription`, pas directement depuis une colonne mensuelle) ; `numero=1..11` pour Octobre..Août dans l'ordre des colonnes du fichier. |
| `montant` | `montant` | Issu de `ModalitePaiement.montant_echeance` pour le niveau/année (le fichier ne porte pas le montant *dû* par échéance, seulement les sommes *versées* dans la colonne `Somme`) — **l'échéancier attendu (montant dû) doit donc être matérialisé depuis le barème**, pas depuis l'Excel, qui ne documente que les versements réalisés. |
| `Somme` (sous-colonne du mois) | → alimente `Encaissement`/`ImputationEncaissement`, pas `Echeance.montant_paye` directement | `Echeance.montant_paye`/`statut` sont recalculés par l'application après création des encaissements imputés (ne pas écrire ces deux champs directement depuis l'Excel pour éviter une désynchronisation avec les imputations). |
| `date_echeance` | — | Dérivée du mois (1er jour du mois civil dans l'année scolaire, ex. Octobre de l'année de début) + `ModalitePaiement`. |

**`Encaissement` + `ImputationEncaissement`** — une paire par cellule `(Dates, Somme)`
non vide :

| Colonne Excel | Champ Django | Transformation |
|---|---|---|
| `Dates` (sous-colonne du mois) | `Encaissement.date` | Cellule Excel typée date/heure parfois en `datetime.time` dans le gabarit vide observé (artefact de mise en forme Excel, cf. §1.1 ligne 20 de `recherche Essig` : `datetime.time(0,0)`) — **toute valeur de type `time` sans composante date doit être traitée comme "date manquante", journalisée en erreur, ligne ignorée pour l'encaissement** (ne jamais fabriquer une date arbitraire pour un mouvement de trésorerie). |
| `Somme` (sous-colonne du mois) | `Encaissement.montant_total` | Si `Somme` > 0 mais `Dates` vide (ou inversement) : incohérence → erreur journalisée, pas d'encaissement créé pour cette cellule. Si `Somme` = 0 ou vide : pas de ligne à créer (pas une erreur, simplement rien à importer ce mois). |
| — (absent) | `mode` | Non présent dans le fichier → valeur par défaut `ESPECES` à documenter comme hypothèse de reprise (avertissement journalisé « mode de paiement non tracé dans la source, défaut ESPECES appliqué »). |
| — (absent) | `compte` | Non présent → paramètre d'import (compte caisse par défaut de l'école), car `Encaissement.compte` est obligatoire. |
| — (absent) | `mouvement` | `OneToOneField` obligatoire vers `tresorerie.Mouvement` → doit être créé par l'import en même temps que l'`Encaissement` (même montant/date/compte), pas laissable vide : un `Encaissement` sans `Mouvement` violerait le modèle. |
| (généré) | `recu_numero` | Cf. §1.2 — numéro synthétique déterministe pour idempotence, unique (`unique=True` dans le modèle). |
| — | `statut` | `VALIDE` (les versements historiques sont considérés actés), pas `EN_COURS`. |
| (ImputationEncaissement) | `cible=ECHEANCE`, `echeance=<Echeance numero du même mois>`, `montant=Somme` | Imputation 1:1 simple montant complet sur l'échéance du mois correspondant ; si `Somme` dépasse le `montant` restant dû de l'échéance (trop-perçu), journaliser en avertissement plutôt que planter (l'excédent reste imputé, charge à l'application de gérer le statut `surpaye`). |

### 1.5 Colonnes de synthèse non importées directement

`Total versé`, `Total restant`, `Situation` sont des **colonnes calculées** côté
Excel (sommes/formules) — elles ne doivent pas être écrites dans un champ
modèle : elles servent uniquement de **contrôle de cohérence post-import**
(comparer `Total versé` Excel à la somme des `Encaissement.montant_total`
importés pour l'inscription, et journaliser un écart en avertissement, jamais
en erreur bloquante, car l'écart peut aussi révéler une erreur dans le fichier
source lui-même).

---

## 2. Feuilles `recherche Essig` / `Recherche CFPA` / `Recherche UPSS`

Ces feuilles sont des **formulaires de consultation** (saisie d'un numéro
d'ordre en cellule, affichage en retour du nom, niveau, options, coût,
échéancier) — pas des tables de données ligne-par-étudiant. Observé : en-tête
établissement (lignes 4-7), zone de saisie « SAISISSEZ LE NUMERO D'ORDRE »,
puis un bloc `NIVEAU`/`OPTIONS`/`TYPE DE FORMATION` et un tableau
`Mois`/`Dates`/`sommes` recopiant la même structure que les feuilles
ESSIG/ESSS/CFPA pour l'étudiant sélectionné.

**Décision de mapping : ces 3 feuilles ne sont pas une source d'import.**
Elles sont dérivées (vue de calcul Excel) des feuilles ESSIG/ESSS/CFPA et ne
doivent **pas** être lues par l'import pour créer ou mettre à jour des
`Etudiant`/`Inscription`/`Echeance`, sous peine de doublons ou d'écrasement
par des valeurs de formule (`0`, `datetime.time(0,0)`) qui ne représentent
aucune vraie donnée tant qu'aucun numéro n'est saisi. Elles correspondent
côté cible à la vue `v_etat_scolarite_etudiant` déjà listée dans
`db/CORRESPONDANCE.md` — c'est à cette vue applicative de reproduire ce
rendu après import, pas à l'import de les consommer en entrée.

L'implémenteur doit journaliser cette décision (ou, si une future version du
classeur contient des données exploitables sur ces feuilles, ouvrir un ticket
de reprise des enquêtes plutôt que de les ignorer silencieusement).

---

## 3. Feuilles `unforme` (tenues) et `frais des copies` (photocopies)

### 3.1 Structure Excel observée

Les deux feuilles partagent la même structure en 3 blocs horizontaux
(ESSIG / UPSS / CFPA) + un bloc `BILAN` récapitulatif :

| Colonne (par bloc) | Libellé |
|---|---|
| `N° ordre` | rang (non fiable comme clé, cf. §1.2 — ce n'est pas le `numero_ordre` d'inscription, c'est une numérotation locale à cette feuille) |
| `NOMS ET PRENOMS` | nom complet, texte libre |
| `NIVEAU` | niveau, texte libre |
| `ETAT DE Payement` | `NON` / `partiel` / `OUI` (valeurs observées sur les 3 premières lignes seulement — colonnes majoritairement vides ensuite dans le gabarit) |
| `Somme` | montant payé |

Bloc `BILAN` (colonnes `ECOLE`/`NOMBRE`/`SOMME`) : agrégat calculé, **non
importable** (même raisonnement que §1.5 — c'est une formule de synthèse).

### 3.2 Clé naturelle d'idempotence

Pas de matricule ni d'identifiant stable sur ces feuilles — uniquement
`NOMS ET PRENOMS` + `NIVEAU` + école (bloc). **Clé naturelle recommandée** :
résoudre l'étudiant par **matricule retrouvé via correspondance nom+niveau sur
les feuilles ESSIG/ESSS/CFPA de la même année** (jointure applicative, pas une
clé intrinsèque à cette feuille). Toute ligne dont le nom ne trouve **aucune**
correspondance unique dans la feuille école correspondante (ESSIG/ESSS/CFPA)
doit être journalisée en erreur (« frais TENUE/PHOTOCOPIE sans étudiant
résolu : "<nom>" / niveau "<niveau>" ») et ignorée plutôt que de créer un
`Etudiant` orphelin à partir d'un nom seul. Si la correspondance trouve
**plusieurs** étudiants homonymes au même niveau, journaliser également en
erreur (ambiguïté), ne jamais choisir arbitrairement le premier.

La clé d'upsert finale, une fois l'étudiant résolu, est
`(inscription, type_frais)` — contrainte `unique_together` du modèle
`FraisInscription`.

### 3.3 Mapping colonnes → champs

**`TypeFrais`** (préalable, pas ligne-par-ligne — un `TypeFrais` par
(école, type, année)) :

| Donnée | Champ Django | Transformation |
|---|---|---|
| Feuille `unforme`, bloc école | `TypeFrais` où `code='TENUE'`, `ecole=<bloc>`, `annee_scolaire=<paramètre import>` | Get_or_create par `(code, ecole, annee_scolaire)` — `code` global `TENUE` partagé entre écoles via le scope `ecole`/`niveau`/`annee_scolaire` nullable du modèle (cf. §structure `TypeFrais` dans `scolarite/models.py` — attention : `code` est `unique=True` globalement dans le modèle actuel, donc **un seul `TypeFrais` TENUE ne peut pas être scopé par école en même temps** ; si l'implémenteur a besoin d'un TENUE par école, il faut soit un code par école (`TENUE-ESSIG`, `TENUE-UPSS`, `TENUE-CFPA`), soit confirmer qu'un seul `TypeFrais` TENUE générique (sans scope école) suffit. **Point à clarifier avec le mandat avant implémentation** — ne pas trancher silencieusement côté import.) |
| Feuille `frais des copies`, bloc école | `TypeFrais` où `code='PHOTOCOPIE'` (même remarque sur le scope) | idem |

**`FraisInscription`** (upsert par `(inscription, type_frais)`) :

| Colonne Excel | Champ Django | Transformation |
|---|---|---|
| `Somme` | `montant_du` | Montant lu directement ; si vide/0 et `ETAT DE Payement` vide, considérer la ligne comme "non concernée" (pas d'erreur, pas de `FraisInscription` créé) plutôt que de créer un frais à 0 pour tout le monde. |
| `ETAT DE Payement` (`NON`/`partiel`/`OUI`) | — | Ne correspond à aucun champ direct de `FraisInscription` (qui n'a pas de statut de paiement propre — c'est `Echeance.statut` ou le calcul d'imputations qui porte ce rôle pour les échéances, mais `FraisInscription` n'a qu'un `montant_du`/`exonere`). Transformation : `OUI` → créer aussi un `Encaissement`+`ImputationEncaissement` (`cible=FRAIS`, `frais_inscription=<ligne>`) du même montant que `Somme`, statut `VALIDE` ; `partiel` → créer l'imputation pour le montant effectivement indiqué dans `Somme` (qui représente alors ce qui a été payé, pas le dû — **ambiguïté documentée** : le fichier ne distingue pas montant dû vs montant payé pour ces deux feuilles, contrairement aux feuilles ESSIG/ESSS/CFPA ; l'implémenteur doit journaliser cette hypothèse comme un avertissement systématique, pas silencieusement) ; `NON` ou vide → `FraisInscription.montant_du=Somme` sans encaissement associé. |
| `exonere` | — | Jamais renseigné depuis cette source → `False` par défaut. |

---

## 4. Journalisation des erreurs — règles transverses

Toute erreur de ligne doit être **journalisée et sautée**, jamais une
exception qui interrompt tout l'import. Catégories d'erreurs attendues,
à toutes remonter avec : nom de la feuille, numéro de ligne Excel, valeur(s)
brute(s) en cause, et la raison :

1. Étudiant sans `N° MATRICULE` (§1.2).
2. `NIVEAU` ou `FILERES ET OPTION` non résolu en FK existante (§1.3).
3. `Ecole` de la feuille non trouvée en configuration (§1.3).
4. `NOMS ET PRENOMS` non séparable en nom/prénoms de façon fiable (§1.4).
5. Cellule `Dates` de type `time` sans date exploitable, ou incohérence
   `Dates`/`Somme` partiellement remplie (§1.4).
6. Écart entre `Total versé`/`Coût de la scolarité` Excel et les montants
   recalculés après import (avertissement de contrôle, §1.5).
7. Ligne `unforme`/`frais des copies` dont le nom ne résout à aucun, ou à
   plusieurs, étudiants de la feuille école correspondante (§3.2).
8. Trop-perçu (`Somme` imputée > reste dû de l'échéance) (§1.4).

Les feuilles `recherche Essig`/`Recherche CFPA`/`Recherche UPSS` sont
exclues de l'import (§2) — à signaler une seule fois en information, pas en
erreur répétée par ligne.

---

## 5. Points ouverts à trancher avant implémentation

- Mapping feuille → `Ecole.id` (ESSIG/ESSS/CFPA) : à fournir en configuration,
  absent du fichier.
- Portée exacte du `TypeFrais` TENUE/PHOTOCOPIE (un seul générique vs un par
  école) compte tenu de la contrainte `unique=True` sur `TypeFrais.code`
  (§3.3).
- Hypothèse « mode de paiement par défaut = ESPECES » pour les encaissements
  reconstitués (§1.4) — à confirmer avec le métier.
- Valeur par défaut de `date_inscription` (date de début d'année scolaire) en
  l'absence de date réelle dans le fichier (§1.4).
- Le classeur fourni (`test 2026.xlsx`) est à corps vide pour les feuilles
  structurantes (§ constat en tête de document) : ce mapping doit être
  revalidé dès qu'un classeur d'une année antérieure effectivement rempli sera
  disponible, pour vérifier les hypothèses de transformation sur des données
  réelles (en particulier §1.4 split nom/prénoms, et §3.3 `ETAT DE Payement`).
