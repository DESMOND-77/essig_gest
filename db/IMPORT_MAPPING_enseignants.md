# Mapping d'import legacy — groupe « enseignants » (§16 Phase 10)

Source : `Enseignants.xlsx`, fichier séparé (pas une feuille de
`test 2026.xlsx`), une seule feuille sans nom explicite (`Worksheet`),
plage `A1:D112`.

Référence structurelle : `db/CORRESPONDANCE.md` (ligne `enseignant` →
`enseignant`, « ajout statut, spécialité, taux »). Modèle cible :
`rh_paie.models.Enseignant`.

## 1. Structure Excel observée

Une seule ligne d'en-tête (ligne 1), 111 lignes de données (lignes 2 à 112),
aucune ligne vide, aucune ligne totalement creuse.

| Colonne | Libellé | Exemple(s) |
|---|---|---|
| A | `NOM` | `ABAKER`, `BOUITYVOUBOU ` (espace de fin fréquent), `MANFOUMBI DJOUGUET ` |
| B | `PRENOM` | `Madi Guirema`, `Térence Kevin`, `Wendy Ray D\'Olive` |
| C | `TELEPHONE` | `062-12-77-12` ; `066-25-32-92 / 077-98-24-36` (deux numéros séparés par `/`) ; une cellule (ligne 51, `MANFOUMBI DJOUGUET`) est un **entier Excel** `24174436161` au lieu d'un texte |
| D | `EMAIL` | vide sur 96/111 lignes ; renseigné sur 15 lignes, format `xxx@gmail.com`/`@yahoo.fr` |

Constats sur les 111 lignes :
- `NOM`/`PRENOM` toujours renseignés (0 ligne vide sur ces deux colonnes).
- Aucun doublon exact `(NOM, PRENOM)` normalisé (trim + upper) sur ce
  classeur, mais ce n'est **pas garanti en général** (le fichier n'a pas de
  matricule ni d'identifiant propre — cf. §3 clé d'idempotence).
- `TELEPHONE` : presque toujours une chaîne, parfois deux numéros séparés
  par `/` (62 lignes concernées sur 111), une seule cellule est un nombre
  (ligne 51 → `24174436161`, à traiter comme `+241 74 43 61 61` probable).
- `EMAIL` vide sur la majorité des lignes (86 %) → champ optionnel côté
  import, ne jamais bloquer une ligne pour absence d'email.
- Espaces de début/fin fréquents sur `NOM` et `PRENOM` (ex. `BOUITYVOUBOU `,
  `MOUNIOKO `, `Franck `) → `strip()` systématique obligatoire avant toute
  comparaison ou écriture.

Le modèle `Enseignant` cible porte en plus des champs **absents de ce
fichier** : `specialite`, `statut` (`VACATAIRE`/`PERMANENT`, défaut
`VACATAIRE`), `taux_horaire`, `actif` — aucun n'est dérivable de
`Enseignants.xlsx`. Ce fichier ne couvre que l'**identité** de l'enseignant ;
le reste (spécialité, statut, taux, affectations) devra être saisi ou importé
séparément (autre source, non fournie ici).

## 2. Mapping colonnes Excel → champs Django

| Colonne Excel | Champ `Enseignant` | Transformation |
|---|---|---|
| `NOM` | `nom` | `str(valeur).strip()`. Rejeter (erreur journalisée) si vide après strip — ne devrait pas arriver sur ce fichier mais à garder en garde-fou générique. |
| `PRENOM` | `prenom` | `str(valeur).strip()`. Même garde-fou que `nom`. |
| `TELEPHONE` | `telephone` | Si la cellule est un `int`/`float` (cas ligne 51), convertir en chaîne sans notation scientifique (`str(int(valeur))`) puis journaliser un **avertissement** (« TELEPHONE numérique converti en texte, vérifier le formatage » — un nombre comme `24174436161` a probablement perdu un `+` ou un `0` de tête lors de la saisie). Sinon `str(valeur).strip()`. Le champ `telephone` du modèle est un simple `CharField` non structuré : les valeurs multi-numéros (`"X / Y"`) sont stockées **telles quelles**, aucun éclatement en plusieurs champs/lignes n'est fait (le modèle n'a qu'un seul champ téléphone) — à documenter comme limitation connue, pas une erreur d'import. |
| `EMAIL` | `email` | Si vide/`None` → `None` (le champ est `blank=True, null=True`). Si renseigné : `str(valeur).strip().lower()`. Le modèle impose `unique=True` sur `email` **non-null** : si l'email strippé existe déjà pour un *autre* enseignant (après résolution par la clé naturelle du §3), journaliser une erreur (« email déjà utilisé par un autre enseignant : "<email>" ») et importer la ligne **sans** email plutôt que de planter sur la contrainte unique ou d'écraser le mauvais enseignant. |
| — | `specialite` | Absent de la source → `None`. |
| — | `statut` | Absent de la source → valeur par défaut du modèle, `VACATAIRE`. |
| — | `taux_horaire` | Absent de la source → `None`. |
| — | `actif` | Absent de la source → valeur par défaut du modèle, `True`. |
| — | `cree_par` / `modifie_par` | À renseigner avec l'utilisateur technique exécutant le script d'import (ou `None` si le modèle l'autorise, ce qui est le cas — `blank=True, null=True`). |

## 3. Clé naturelle d'idempotence

Le fichier **ne fournit aucun identifiant stable** (pas de matricule, pas de
code enseignant). La seule clé disponible est donc **`(nom, prenom)`
normalisés** (`strip()` + comparaison insensible à la casse, par ex. via
`upper()`), à utiliser pour un `get_or_create`/`update_or_create` sur
`Enseignant`.

Limites et risques à documenter explicitement pour l'implémenteur :
- Deux enseignants homonymes réels (même nom et prénom, personnes
  différentes) seraient **fusionnés à tort** par cette clé. Sur ce classeur
  précis, aucun doublon exact n'a été détecté (111 lignes → 111 couples
  distincts), donc le risque ne s'est pas matérialisé ici, mais la clé reste
  intrinsèquement fragile. Recommandation : traiter l'import comme un
  **import initial** (cf. `CORRESPONDANCE.md` : « `Enseignants.xlsx` →
  `enseignant` (import initial) ») plutôt qu'un import récurrent idempotent
  strict ; si l'import doit être rejoué, comparer aussi `email` quand il est
  renseigné pour désambiguïser deux couples nom/prénom identiques avant de
  fusionner.
- Si, lors d'un rejeu futur, deux lignes du fichier source partagent le même
  couple `(nom, prenom)` normalisé avec des `telephone`/`email` différents,
  journaliser une **ambiguïté** (« plusieurs lignes source pour le même
  enseignant "<nom> <prenom>", valeurs divergentes ») plutôt que d'écraser
  silencieusement l'une par l'autre — garder la dernière ligne rencontrée et
  signaler l'écart.

## 4. Lignes/valeurs ambiguës ou manquantes à journaliser (sans jamais planter)

1. **`NOM` ou `PRENOM` vide** (non observé sur ce fichier mais garde-fou
   générique) → ligne ignorée, erreur journalisée avec le numéro de ligne
   Excel et les valeurs brutes des 4 colonnes.
2. **`TELEPHONE` de type numérique** (ex. ligne 51, `24174436161`) →
   converti en texte, avertissement journalisé (perte possible de `+`/`0`
   de tête), ligne **non bloquée**.
3. **`TELEPHONE` multi-numéros** (`"X / Y"`, 62/111 lignes) → stocké tel
   quel dans le `CharField` unique, information journalisée une seule fois
   en début d'import (pas répétée par ligne) pour signaler que le modèle ne
   distingue pas plusieurs numéros par enseignant.
4. **`EMAIL` déjà pris par un autre enseignant** (contrainte `unique=True`)
   → ligne importée sans email, erreur journalisée avec le couple
   nom/prénom et l'email en conflit.
5. **`EMAIL` au format invalide** (pas de `@`, domaine manifestement
   cassé) → import sans email, avertissement journalisé plutôt que de
   lever une `ValidationError` qui interromprait tout le batch.
6. **Espaces parasites dans `NOM`/`PRENOM`** (ex. `BOUITYVOUBOU `,
   `MOUNIOKO `, `Franck `) → corrigés silencieusement par `strip()`, pas
   d'erreur (comportement attendu, pas une anomalie de donnée).
7. **Caractères d'échappement résiduels** dans `PRENOM` (ex.
   `"Wendy Ray D\'Olive"` contient un `\` littéral avant l'apostrophe,
   probablement un artefact d'export) → à **nettoyer** (`.replace("\\'", "'")`
   ou équivalent) et journaliser un avertissement indiquant la valeur brute
   et la valeur corrigée, pour que l'implémenteur puisse vérifier d'autres
   occurrences similaires sur un classeur futur plus large.
8. **Couple `(nom, prenom)` ambigu lors d'un rejeu** (cf. §3) → ligne
   traitée comme mise à jour de l'enregistrement existant, écart journalisé
   en avertissement si `telephone`/`email` divergent sensiblement de la
   valeur déjà en base.
9. **Ligne entièrement vide** (si elle apparaît dans un classeur futur plus
   grand que celui inspecté) → ignorée silencieusement (pas une erreur,
   simple ligne de mise en page), à ne journaliser qu'en comptage global
   (« N lignes vides ignorées »).

## 5. Points ouverts à trancher avant implémentation

- Aucun champ source ne permet de déduire `statut` (`VACATAIRE`/
  `PERMANENT`), `specialite` ou `taux_horaire` : à confirmer que ces
  colonnes seront saisies manuellement après l'import initial, ou qu'une
  autre source (non fournie dans ce lot) les complètera dans un second
  import `update_or_create` sur la même clé `(nom, prenom)`.
- Le classeur fourni ne couvre qu'un seul établissement/année implicite (pas
  de colonne `ECOLE` ni `ANNEE`) alors que `CORRESPONDANCE.md` ne mentionne
  pas d'affectation école pour `Enseignant` (le lien école se fait via
  `AffectationEnseignement`/`Classe`, hors scope de ce fichier) — à confirmer
  qu'aucun rattachement école n'est attendu à ce stade de l'import.
  Le modèle `Enseignant` lui-même ne porte d'ailleurs pas de FK `Ecole`.
  Cette hypothèse (import d'identité pure, sans affectation) est conforme à
  la ligne `CORRESPONDANCE.md` « `Enseignants.xlsx` → `enseignant` (import
  initial) ».
- Décider si la clé `(nom, prenom)` doit être renforcée par `email` (quand
  disponible) pour réduire le risque d'homonymes avant un rejeu de l'import
  sur un classeur mis à jour.
