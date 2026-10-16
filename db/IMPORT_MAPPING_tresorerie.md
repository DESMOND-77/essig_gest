# Mapping d'import legacy — groupe `tresorerie` (§16 Phase 10)

Source : `/home/foxtrot/Documents/ESSIG/el_Amine/test 2026.xlsx`
Feuilles inspectées : `DEPENSES`, `VERSEMENTS ` (espace final dans le nom réel), `BILAN ESSIG`, `BILAN UPSS`, `BILAN CFPA ` (espace final), `BILAN TOTAL`.
Modèles cibles : `tresorerie.models` (`Compte`, `CategorieMouvement`, `Mouvement`, `Virement`, `Encaissement`, `ImputationEncaissement`, `Depense`, `ArreteCaisse`, `Billetage`).

**Constat préalable important** : dans le classeur fourni, les 6 feuilles listées ne contiennent **aucune ligne de données réelles** — uniquement l'entête de colonnes, des formules à zéro et des lignes gabarit (template vide pour l'année scolaire à venir). Ce mapping est donc écrit pour être appliqué tel quel le jour où un classeur *rempli* (exercice clos, ex. l'historique `mlamine.sql`) sera fourni avec la même structure de colonnes. L'implémenteur doit malgré tout coder l'import pour ce gabarit car c'est le seul schéma de colonnes disponible à ce stade.

---

## 1. Feuille `DEPENSES`

La feuille contient 4 sous-tableaux côte à côte sur les mêmes lignes (entête ligne 5, données à partir de la ligne 6) :

### 1.1 Sous-tableau « DEPENSES » (colonnes A-C)

| Colonne Excel | Entête | Champ(s) modèle cible | Transformation |
|---|---|---|---|
| A | `DATES` | `Depense.date` | Parser date Excel (`datetime` déjà résolu par `openpyxl` avec `data_only=True`) → `date()`. Si vide alors que B/C sont remplis → ligne invalide, **log erreur**, ne pas importer. |
| B | `DESIGNATIONS` | `Depense.designation` | Texte brut, `strip()`. Si vide → log erreur (champ obligatoire). |
| C | `SOMMES` | `Depense.montant` (et `Mouvement.montant` du mouvement associé) | Cast en `Decimal`, arrondi entier (le modèle est `decimal_places=0`). Négatif ou zéro → log erreur (contrainte `chk_depense_montant_positif`). |

Champs du modèle `Depense` **non présents** dans cette feuille et à renseigner par défaut/déduction lors de l'import :
- `categorie_mouvement` : la feuille ne distingue pas de catégorie. **Ambigu** → créer/utiliser une catégorie `CategorieMouvement` par défaut de type `SORTIE` (ex. code `DIVERS`, à faire valider par le métier) et journaliser un avertissement « catégorie déduite par défaut » pour chaque ligne. Si plus tard une colonne catégorie apparaît dans un classeur réel, la reprendre en priorité.
- `beneficiaire` : absent de la feuille. Réutiliser `DESIGNATIONS` comme fallback, en journalisant l'absence de bénéficiaire distinct (champ obligatoire du modèle, `max_length=150`).
- `compte` : absent. **Ambigu** — à résoudre par le groupe « VERSEMENTS » / contexte (caisse principale par défaut) ; si aucun compte ne peut être déduit, **rejeter la ligne avec erreur journalisée** plutôt que deviner un compte au hasard (impact financier).
- `ecole` : absent sur cette feuille (les dépenses y sont globales au groupe scolaire). Laisser `NULL` (le champ est `blank=True, null=True`), sauf si le nom de fichier/feuille permet de déduire une école (à vérifier avec le classeur réel rempli, qui pourrait être dupliqué par école/pôle).
- `annee_scolaire` : à déduire du nom du classeur (`test 2026.xlsx` → année scolaire 2025-2026 ou 2026-2027, **à confirmer avec le métier**) ou passé en paramètre fixe du script d'import plutôt que lu ligne à ligne.
- `piece_justificative` : absent de la feuille → `NULL`.
- `statut` : forcer `PAYEE` à l'import (donnée historique déjà clôturée), **jamais** `ENGAGEE` (pour ne pas permettre une modification a posteriori qui réécrirait l'historique).
- `mouvement` : **créer un `Mouvement`** correspondant (sens `DEBIT`, même `date_operation`, `montant`, `compte`, `categorie_mouvement`, `ecole`, `annee_scolaire` que la `Depense`) avant de créer la `Depense`, car `Depense.mouvement` est un `OneToOneField` obligatoire (`on_delete=RESTRICT`).

**Clé naturelle (idempotence)** : aucune colonne de pièce/numéro de référence sur cette feuille. Proposer la clé composite `(date, designation, montant)` en l'absence de meilleur candidat, et journaliser un avertissement de risque de doublon si deux lignes legacy partagent exactement ces 3 valeurs (le réimport ne pourra pas les distinguer). **Idéalement**, si le classeur réel comporte un numéro de pièce (absent ici), l'utiliser à la place et le stocker dans `Depense.piece_justificative` ou une colonne d'import dédiée.

### 1.2 Sous-tableau « SALAIRE ENSEIGNANT » (colonnes F-J)

Entêtes : `DATES`, `NOM DE L'ENSEIGNANT`, `MATIERES`, `Niveau/Ecole`, `SOMMES`.

Ce sous-tableau **ne correspond à aucun modèle du groupe `tresorerie`** fourni dans la liste de la tâche (il relève plutôt de `rh_paie` : paiement d'enseignant). **Hors périmètre strict** de ce mapping, mais pour la traçabilité :
- S'il faut l'importer malgré tout comme dépense, le traiter comme une `Depense` avec `categorie_mouvement` = catégorie `SALAIRE_ENSEIGNANT` (à créer), `beneficiaire` = colonne `NOM DE L'ENSEIGNANT`, `designation` = concaténation `MATIERES` + `Niveau/Ecole`, `montant` = `SOMMES`, `date` = `DATES`.
- **Recommandation** : traiter ce sous-tableau dans le mapping du groupe `rh_paie` (modèle `SalaireEnseignant` mentionné dans `CORRESPONDANCE.md`), pas ici, pour éviter la double comptabilisation d'un même paiement en `Depense` ET en `SalaireEnseignant`. Mentionner ce point de coordination à l'implémenteur en tête de ticket.

### 1.3 Sous-tableau « ENTREES /MOIS » (colonne N, libellés de mois)

Colonne N : juste la liste des 12 mois (`Octobre`...`Août`) sans valeur numérique dans le gabarit vide — c'est un total agrégé mensuel, pas une ligne transactionnelle. **Ne correspond à aucune ligne `Mouvement` individuelle** : c'est une vue récapitulative (cf. `v_bilan_mensuel` dans `CORRESPONDANCE.md`). **Ne pas importer** directement ; ce total doit être **recalculé** par agrégation des `Mouvement.sens=CREDIT` du mois, pas repris tel quel depuis Excel (risque de désynchronisation avec les lignes détail).

### 1.4 Sous-tableau « SALAIRE ADMINISTRATION » (colonnes T-W)

Entêtes : `Noms`, `salaire`, `Avance`, `Reste`.

Même remarque que 1.2 : relève de `rh_paie`, hors périmètre `tresorerie` strict. Si l'implémenteur doit malgré tout le rattacher à une `Depense` :
- `beneficiaire` = `Noms`
- `designation` = `"Salaire administration"` (constante)
- `montant` = `salaire` (colonne `Avance` représente un acompte déjà versé : si non nul, créer une seconde `Depense`/`Mouvement` distincte pour l'avance avec sa propre date, car `Avance` n'a pas de date dans la feuille — **ambigu, à journaliser en erreur si `Avance` ≠ 0 sans date associée**).
- Ligne `Total` / `TOTAL` (dernière ligne de chaque bloc, ex. ligne 13 : `('Total', 1410000, 0, 1410000, ...)`) : **ligne calculée, à exclure explicitement de l'import** (détection : colonne "Noms" == `"Total"`/`"TOTAL"`, insensible à la casse).

---

## 2. Feuille `VERSEMENTS `

Deux sous-tableaux côte à côte : « Versements » (colonnes B-C) et « Retraits » (colonnes F-G), chacun avec en-tête `DATES` / `SOMMES`, plus une zone « PRELEVEMENT BANCAIRE » plus bas et des lignes `Total` intermédiaires (lignes 21 et 41) et finales (ligne 48).

| Colonne Excel | Entête | Champ(s) modèle cible | Transformation |
|---|---|---|---|
| B (Versements) | `DATES` | `Mouvement.date_operation` | Date Excel → `date()`. |
| C (Versements) | `SOMMES` | `Mouvement.montant` | `Decimal`, positif obligatoire. `sens` = `CREDIT`. |
| F (Retraits) | `DATES` | `Mouvement.date_operation` | idem. |
| G (Retraits) | `SOMMES` | `Mouvement.montant` | `sens` = `DEBIT`. |

Ce sous-tableau correspond à `mouvement` (compte banque) + `virement`, conformément à `CORRESPONDANCE.md` (ligne `versements` → `mouvement`/`virement`). Points à trancher par l'implémenteur :

- **`compte`** : le nom de la feuille/du bloc ne précise pas quel compte bancaire (il peut y avoir plusieurs comptes banque — cf. `BILAN TOTAL` colonnes "compte A" / "Compte B" / "MACHINE"). **Ambigu** → le classeur réel devra porter une colonne ou un nom de feuille par compte ; en son absence, résoudre le compte via le libellé de feuille ou un paramètre fixe fourni à l'import, et **rejeter en erreur journalisée** toute ligne où le compte ne peut pas être déterminé sans ambiguïté.
- **« Retraits »** : un retrait de compte banque est soit (a) un virement vers la caisse (→ créer un `Virement` avec `compte_source` = banque, `compte_destination` = caisse, ce qui génère automatiquement 2 `Mouvement` liés), soit (b) une sortie simple sans contrepartie identifiée (→ un seul `Mouvement` `DEBIT` avec une `CategorieMouvement` générique "retrait"). **Le classeur ne permet pas de distinguer les deux cas** → traiter par défaut comme (b) et journaliser un avertissement « retrait sans contrepartie identifiée, à vérifier manuellement », car créer un faux `Virement` fausserait le solde du compte destination.
- **Bloc « PRELEVEMENT BANCAIRE »** (ligne 14, colonne O) : zone libre sans structure tabulaire exploitable dans le gabarit (aucune colonne de date/montant repérée dessous). **À traiter manuellement / hors import automatique**, journaliser et signaler à l'implémenteur pour vérification visuelle du classeur réel.
- **Lignes `Total`/`TOTAL`** (lignes 21, 41, 48) : lignes calculées, **à exclure explicitement** de l'import (détection par la valeur textuelle `Total`/`TOTAL` dans la colonne date).
- **`categorie_mouvement`** : absente de la feuille → déduire une catégorie par défaut (`VERSEMENT_BANQUE` / `RETRAIT_BANQUE`), à créer en données de référence avant l'import si elle n'existe pas, journaliser la création automatique.
- **`annee_scolaire`**, **`ecole`** : mêmes remarques que pour `DEPENSES` §1.1 (paramètres fixes de l'import, pas de colonne source).

**Clé naturelle (idempotence)** : `(compte, date_operation, sens, montant)` — faute de numéro de pièce sur cette feuille. Journaliser un avertissement si deux lignes legacy ont exactement les 4 mêmes valeurs (impossible de les distinguer sans numéro de pièce ; `piece_reference` restera `NULL`).

---

## 3. Feuilles `BILAN ESSIG`, `BILAN UPSS`, `BILAN CFPA ` (une par pôle/école)

Structure identique sur les 3 feuilles (entête fusionné sur 2 lignes 1-2, données à partir de la ligne 4) :

| Colonne Excel | Entête | Champ(s) modèle cible | Transformation |
|---|---|---|---|
| A | `N° ordre` | `Inscription.numero_ordre` (clé naturelle principale, cf. `CORRESPONDANCE.md` : `numero_odre` → `inscription.numero_ordre`, rang d'inscription dans l'année par école) | Entier, `>= 1`. Combiné à l'école (déduite du nom de la feuille) et à l'année scolaire pour résoudre l'`Inscription` existante — **ne pas créer l'inscription depuis cette feuille** : elle doit préexister (créée par le groupe `scolarite`/`personnes`) ; si `(ecole, annee_scolaire, numero_ordre)` ne résout aucune `Inscription`, **log erreur, ligne ignorée**. |
| B | `NOMS ET PRENOMS` | *(contrôle croisé uniquement, pas de champ direct)* | Utilisé seulement pour vérifier par recoupement humain que le `numero_ordre` résolu correspond bien au bon étudiant (comparer à `Inscription.etudiant.nom`/`prenoms`) ; en cas de désaccord, **log erreur "incohérence nom/numéro d'ordre"**, ne pas bloquer l'import mais signaler. |
| C | `NIVEAU` | *(contrôle croisé)* | Idem, comparé à `Inscription.classe.niveau` (ou équivalent) pour détecter une désynchronisation entre le classeur et la base. |
| D | `FILERES ET OPTION` | *(contrôle croisé)* | Idem. |
| E (ESSIG uniquement) | `TYPE DE FORMATION` | *(contrôle croisé)* | Comparable à `ModaliteFormation`. Absent sur UPSS/CFPA (décalage de colonnes : sur ces 2 feuilles, les mois commencent dès la colonne E, pas F — **l'implémenteur doit lire par nom d'en-tête, jamais par index de colonne fixe**, car l'offset diffère entre `BILAN ESSIG` et `BILAN UPSS`/`BILAN CFPA`). |
| Paires `Dates`/`Somme` pour chaque mois (`Octobre`→`Août`) | — | `Encaissement` (+ `Mouvement` CREDIT associé) + `ImputationEncaissement` | Pour chaque mois où `Somme` est renseignée (non nulle/non zéro) : créer un `Encaissement` avec `date` = valeur `Dates` du même mois, `montant_total` = `Somme`, `inscription` = celle résolue via `N° ordre`. `mode` : absent de la feuille → **ambigu**, déduire `ESPECES` par défaut (paiement en caisse, cas majoritaire en milieu scolaire local) et journaliser l'hypothèse. `compte` : même ambiguïté que §1/§2, à résoudre par paramètre d'import ou feuille `VERSEMENTS`/compte caisse par défaut. `recu_numero` : absent → **générer un numéro de reçu synthétique** (ex. `IMPORT-<annee>-<ecole>-<numero_ordre>-<mois>`) car le champ est `unique=True` et obligatoire ; journaliser qu'il s'agit d'un numéro généré, pas d'un vrai reçu papier. Puis créer une `ImputationEncaissement` (`cible=ECHEANCE`) vers l'`Echeance` du mois correspondant de l'inscription (résolution par mapping mois→`numero` d'échéance, à construire avec le métier car le modèle `Echeance.numero` est un entier 0..N, pas un nom de mois) ; si aucune échéance ne correspond, **log erreur "échéance introuvable pour ce mois"**, ne pas créer l'imputation orpheline. |
| `Total versé` | — | *(contrôle, recalculable)* | Doit égaler la somme des `Encaissement` importés pour cette inscription ; si écart, **log avertissement "total versé Excel ≠ somme recalculée"** (indice d'erreur de saisie dans le classeur source). |
| `Coût de la scolarité` | — | *(contrôle)* | Comparable à `ModalitePaiement.montant_total` pour le niveau/année de l'inscription ; écart → log avertissement. |
| `Total restant` | — | *(contrôle, recalculable)* | `Coût de la scolarité - Total versé`, ne doit pas être importé tel quel (c'est une formule, pas une donnée source). |
| `Situation` | — | *(non mappé)* | Texte libre de statut (ex. "à jour", "en retard") — purement informatif côté Excel ; le statut réel est porté par `Echeance.statut`, recalculé par les services métier, pas repris depuis Excel. |
| `N° MATRICULE ` (dernière colonne utile) | — | `Etudiant.matricule` | **Attention** : sur le gabarit inspecté, cette colonne contient en réalité des valeurs de niveau (`"L 1"`, `"L 2"`, `"Master"`, etc.) et non des matricules — c'est une liste de référence (combo de niveaux) collée à droite du tableau, **sans rapport avec la ligne étudiant correspondante**. **Ne jamais importer cette colonne comme matricule** ; si le classeur réel a un vrai matricule ici, vérifier d'abord qu'il correspond ligne à ligne à l'étudiant avant de l'utiliser, sinon s'appuyer uniquement sur `numero_ordre` + école + année. |
| Colonnes après `N° MATRICULE` (`Colonne1`, `Colonne2`, filières libres...) | — | *(non mappé)* | Résidus de liste de référence (listes déroulantes Excel), à ignorer intégralement à l'import. |

**Clé naturelle (idempotence)** : `(ecole, annee_scolaire, inscription.numero_ordre, mois)` pour chaque `Encaissement` importé depuis ces feuilles — un encaissement déjà importé pour (inscription, mois) ne doit pas être recréé (vérifier via `recu_numero` synthétique déterministe ou une table de correspondance d'import dédiée).

**École déduite du nom de la feuille** : `BILAN ESSIG` → école ESSIG, `BILAN UPSS` → UPSS, `BILAN CFPA ` → CFPA (attention à l'espace final dans le nom réel de l'onglet lors du parsing programmatique — utiliser `.strip()` sur les noms de feuilles).

---

## 4. Feuille `BILAN TOTAL`

Vue de synthèse consolidée (`v_bilan_consolide`, `v_solde_compte`, `v_arrete_caisse`, `billetage` selon `CORRESPONDANCE.md`). C'est une **feuille de recalcul, pas une source transactionnelle** :

| Zone | Entête | Champ(s) modèle cible | Transformation |
|---|---|---|---|
| A4:B8 | `NOM ENTITE` / `SOMME` (ESSIG, ESSS, CFPA, TOTAL, DEPENSES, AIRTEL MONEY, Somme en Banque, RESTE EN CAISSE) | *(non importé — recalculable)* | Ces soldes doivent être **recalculés par agrégation** des `Mouvement`/`Encaissement`/`Depense` déjà importés, jamais repris tels quels (ce sont des totaux Excel, potentiellement obsolètes ou désynchronisés par rapport au détail). |
| D4:G15 | `Mois` / `Entrées` / `Dépenses` / `Reste` | *(non importé — recalculable)* | Idem, vue `v_bilan_mensuel`. |
| J4:L11 | `billets` / `nbres` / `total` (dénominations 10000, 5000, 2000, 1000, 500) | `Billetage.denomination` / `Billetage.quantite` | **Si** ces lignes sont remplies dans un classeur réel (ici à zéro), elles correspondent à un comptage de caisse : `denomination` = valeur colonne "billets" (ex. 10000), `quantite` = colonne "nbres". **Nécessite un `ArreteCaisse` parent** (`compte` type `CAISSE`, `date`, `solde_theorique`, `solde_physique`) qui n'existe pas explicitement sur cette feuille comme une ligne unique — **ambigu** : il faut déduire la date de l'arrêté (date de l'onglet ? date du jour de l'extraction ?) et le compte caisse concerné. À défaut d'information fiable, **ne pas créer de `Billetage`/`ArreteCaisse` automatiquement** ; journaliser une alerte « comptage de caisse détecté, création manuelle requise » et laisser l'implémenteur ou un opérateur confirmer compte/date avant de matérialiser l'arrêté. |
| N13:Q13+ | `MACHINE`, `compte A`, `Compte B`, `TENUE`, `total`, `BANQUE` | `Compte` (référentiel) | Ces libellés sont probablement des noms de `Compte` existants ou à créer en référentiel (`Compte.libelle`). **Ne pas déduire automatiquement leur `Compte.type`** (`CAISSE`/`BANQUE`/`MOBILE_MONEY`/`VIRTUEL`) à partir du seul libellé sans confirmation — journaliser chaque nouveau libellé de compte rencontré pour validation humaine avant création en base (éviter un doublon de compte avec une orthographe légèrement différente, ex. "compte A" vs "Compte A"). |

**Recommandation générale pour cette feuille** : ne RIEN importer directement depuis `BILAN TOTAL` sauf, le cas échéant, la liste de `Compte` référencés (après validation humaine) ; tout le reste (soldes, mensualités) doit être un **résultat calculé a posteriori** par les vues/services (`v_bilan_consolide`, etc.), pas une donnée reprise de l'Excel — sinon le système importerait une photo potentiellement fausse ou obsolète des soldes, qui divergerait du détail `Mouvement` réellement importé.

---

## 5. Règles transverses pour l'implémenteur

1. **Jamais de `raise`/crash sur une ligne anormale** : toute ligne dont une valeur obligatoire est manquante, mal typée, ou dont une FK (compte, inscription, échéance, catégorie) ne peut être résolue de façon non ambiguë doit être **journalisée** (feuille, ligne Excel, colonnes en cause, valeur brute) dans un rapport d'import et **sautée**, pas bloquer tout le run.
2. **Les lignes `Total`/`TOTAL`/vides/formules à zéro ne sont pas des données** : toujours filtrer sur la présence d'une valeur métier réelle en colonne clé (date ou désignation non vide), jamais sur "ligne non entièrement vide" (une formule à 0 n'est pas vide au sens Excel).
3. **Lire les colonnes par nom d'en-tête, pas par index** : les 3 feuilles `BILAN *` n'ont pas le même décalage de colonnes entre elles (`BILAN ESSIG` a une colonne `TYPE DE FORMATION` que les 2 autres n'ont pas) — un import par position de colonne fixe produirait un décalage silencieux de données.
4. **`annee_scolaire` et paramètres de contexte** (fichier = quel exercice, quelle année) doivent être des **paramètres explicites de la commande d'import**, jamais déduits automatiquement d'une cellule de date d'en-tête (`datetime(2026, 8, 13)` observé en ligne 4 n'est qu'un horodatage d'édition du classeur, pas l'année scolaire concernée).
5. **Idempotence globale** : prévoir une table/journal d'import (fichier source, feuille, ligne Excel, clé naturelle, id de l'objet créé) pour permettre de relancer l'import sans dupliquer — aucune des clés naturelles identifiées ci-dessus (hors `numero_ordre` d'inscription) n'est garantie unique à 100% par la seule donnée source.
6. **Ordre d'import recommandé** : `Compte`/`CategorieMouvement` (référentiel, validé manuellement) → `VERSEMENTS ` (alimente le solde banque) → `BILAN ESSIG`/`BILAN UPSS`/`BILAN CFPA ` (encaissements par inscription, dépend des `Inscription`/`Echeance` déjà créées par les groupes `personnes`/`scolarite`) → `DEPENSES` (hors sous-tableaux RH) → ne **jamais** importer `BILAN TOTAL` (recalculé).
7. **Coordination avec `rh_paie`** : les sous-tableaux « SALAIRE ENSEIGNANT » et « SALAIRE ADMINISTRATION » de la feuille `DEPENSES` doivent être tranchés avec l'équipe responsable du mapping `rh_paie` pour éviter une double comptabilisation (une fois en `Depense` ici, une fois en `SalaireEnseignant`/`SalaireAdministration` là-bas).
