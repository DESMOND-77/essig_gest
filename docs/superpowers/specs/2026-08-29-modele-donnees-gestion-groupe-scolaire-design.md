# Modèle de données — Système de gestion du Groupe Scolaire (USIA / ESSIG)

**Date :** 2026-08-29
**Statut :** design validé, prêt pour plan d'implémentation
**Portée de ce document :** modélisation conceptuelle et logique des données uniquement. Le choix des technologies (SGBD cible, langage, framework applicatif) est explicitement **hors périmètre** et sera traité après validation de ce modèle.

---

## 1. Contexte

Le groupe scolaire de Franceville (Gabon) gère aujourd'hui sa comptabilité et sa scolarité dans un
classeur Excel (`test 2026.xlsx`), à raison d'**un fichier par année scolaire**. Le classeur couvre :
suivi des versements de scolarité par étudiant et par mois, frais annexes (tenue, photocopie,
mutuelle, journée d'intégration, soutenance, examen), dépenses, salaires (enseignants et
administration), trésorerie multi-comptes (caisse, banques, mobile money), bilans mensuels et
consolidés, arrêté de caisse avec billetage, et fiches d'état de scolarité imprimables.

Un premier jet de schéma SQL existe (`mlamine.sql`, 19 tables). Il pose une ossature référentielle
correcte mais présente des lacunes structurelles (pas d'entité « inscription » annuelle, table
`versements` non reliée aux étudiants, agrégats calculés stockés, hiérarchie niveau/filière inversée,
salaires administration absents, pas de grand livre de trésorerie, pas d'utilisateurs). Ce document
définit le modèle cible complet qui remplace ce jet.

Devise unique : **FCFA**, sans sous-unité → tous les montants en `DECIMAL(12,0)`.

## 2. Objectifs

- Base **multi-années** avec historique complet des étudiants, inscriptions et réinscriptions.
- Couvrir 6 domaines : référentiel académique, personnes & inscriptions, scolarité & facturation,
  encaissements & trésorerie, RH & paie, évaluations & résultats.
- Régime **LMD à crédits** (ESSIG, UPSS) **et** régime **classique à moyenne annuelle** (CFPA) dans
  un modèle unifié.
- Toutes les grandeurs dérivées (total versé, reste, état de paiement, moyennes, crédits acquis,
  soldes de comptes, bilans) sont **calculées par des vues**, jamais saisies — sauf figées après
  délibération.
- Traçabilité : utilisateurs, rôles, horodatage auteur sur chaque écriture, journal d'audit.

## 3. Hors périmètre (évolutions futures possibles)

- Comptabilité générale en partie double / plan comptable OHADA (le grand livre de trésorerie
  proposé suffit au besoin du service comptabilité).
- Emploi du temps / planification des salles et créneaux.
- Portail étudiant, notifications, paiement en ligne.
- Gestion RH étendue (congés, contrats, cotisations sociales détaillées).
- Le référentiel `type_piece` / `piece_dossier` est inclus dans le modèle mais son exploitation
  fonctionnelle (relances dossier incomplet, etc.) est laissée à une itération ultérieure.

## 4. Décisions de conception (arbitrages validés)

| # | Sujet | Décision |
|---|---|---|
| D1 | Portée temporelle | Multi-années, historique complet. Entité `inscription` par (étudiant, année). |
| D2 | Portée fonctionnelle | Complète : comptabilité + administration scolarité + académique (notes, crédits, bulletins, délibérations). |
| D3 | Structure LMD | Matières porteuses de crédits directement (pas de couche UE). Validation matière par matière. |
| D4 | Validation matière | Note ≥ 10/20 → validée, crédits acquis. Sinon rattrapage. |
| D5 | Compensation | Aucune. Chaque matière se valide seule. |
| D6 | Rattrapage | Note retenue = `max(note_normale, min(note_rattrapage, 10))`. Une session de rattrapage par semestre. |
| D7 | Passage année supérieure (LMD) | crédits acquis ≥ 48/60 → passage conditionnel avec **dette de crédits** ; ≥ 60 → passage plein ; < 48 → redoublement. La dette doit être soldée l'année suivante avant tout nouveau passage conditionnel. |
| D8 | CFPA | Régime **classique non-LMD** : moyenne annuelle /20, pas de crédits. Moyenne ≥ 10 → admis, sinon redoublement (rattrapage possible). |
| D9 | Multi-entités | `groupe_scolaire` parent de `ecole` (pôles ESSIG, UPSS, CFPA, CICI). Bilans consolidés au niveau groupe. |
| D10 | Grille tarifaire | `modalite_paiement` par (`niveau`, `annee_scolaire`), **indépendante de l'option**. Champs : montant inscription/réinscription, nombre d'échéances, montant par échéance, total généré. |
| D11 | Coût négocié | Surcharge facultative `inscription.cout_scolarite_negocie` ; sinon grille. |
| D12 | Frais annexes | Modèle générique : référentiel `type_frais` + table unique `frais_inscription`. Ajouter un frais = une ligne de référentiel, zéro DDL. |
| D13 | Scolarité | Échéancier explicite `echeance` généré à l'inscription depuis la grille (numéro 0 = inscription, 1..N = mensualités). |
| D14 | Trésorerie | Grand livre unifié : `compte` + `mouvement` (débit/crédit). Tout encaissement et décaissement produit un `mouvement`. Virement = 2 mouvements liés. |
| D15 | Imputation des encaissements | Table `imputation_encaissement`. Ventilation manuelle possible ; sinon auto-FIFO sur les échéances de scolarité. Les frais annexes se règlent par un encaissement dédié pointant le `frais_inscription`. |
| D16 | Boursiers | L'étudiant boursier ne paie que l'inscription/réinscription (échéance 0). Les échéances 1..N portent `pris_en_charge_bourse = TRUE`. Table `bourse` (organisme, montant couvert) pour le suivi du financeur. |
| D17 | Notes | Contrôle continu détaillé : `evaluation` (type, pondération %) + `note_evaluation`. La note matière/session est calculée `Σ(valeur × pondération)`. |
| D18 | Calendrier | `periode` (semestres) unique pour tout le groupe. |
| D19 | Résultats LMD + classique | Modèle unifié : `credits` nullable, `resultat_annuel.regime` distingue le calcul et la règle de décision. |
| D20 | Utilisateurs / audit | `utilisateur` + `role` + `utilisateur_role` (scopable par école) + `journal_audit` générique + colonnes auteur/horodatage sur les tables transactionnelles. |
| D21 | Conventions | `snake_case`, singulier, sans accent, français. PK = `id` auto-incrément. FK = `<table>_id`. Typos de l'existant corrigées (`mutuelle`, `numero_ordre`, `total_verse`). |

## 5. Conventions de modélisation

- **Nom des tables** : `snake_case` singulier, sans accent (`etudiant`, `modalite_paiement`).
- **Clé primaire** : `id` `INT` (ou `BIGINT`) auto-incrément sur toutes les tables.
- **Clés étrangères** : `<table_référencée>_id`. `ON DELETE RESTRICT` par défaut ; `CASCADE`
  uniquement pour les lignes filles strictement dépendantes (`imputation_encaissement` →
  `encaissement`, `billetage` → `arrete_caisse`, `note_evaluation` → `evaluation`,
  `affiliation` → `etudiant`).
- **Montants** : `DECIMAL(12,0)` (FCFA entiers).
- **Notes** : `DECIMAL(4,2)` sur barème 20.
- **Énumérations** : `ENUM` natif si le SGBD le supporte proprement, sinon table de référence +
  FK. Listées ici comme `ENUM(...)` pour la lisibilité.
- **Audit** : colonnes `cree_par` (FK `utilisateur`), `cree_le` (`DATETIME`), `modifie_par`,
  `modifie_le` sur : `inscription`, `frais_inscription`, `echeance`, `encaissement`, `mouvement`,
  `virement`, `depense`, `salaire_enseignant`, `salaire_administration`, `avance_personnel`,
  `note_evaluation`, `resultat_matiere`, `resultat_periode`, `resultat_annuel`, `deliberation`,
  `bourse`, `arrete_caisse`.
- **Colonnes générées** : `montant_total` (grille), `montant` (billetage), `ecart` (arrêté de
  caisse), `montant_prevu` (affectation) sont des colonnes calculées / vues, non saisies.

---

## 6. Modèle détaillé

### Module 1 — Référentiel académique

#### `groupe_scolaire`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| nom | VARCHAR(120) | |
| sigle | VARCHAR(20) | |
| logo | VARCHAR(255) | chemin/URL |
| contacts | VARCHAR(120) | |
| email | VARCHAR(120) | |
| adresse | VARCHAR(255) | |

#### `ecole`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| groupe_scolaire_id | FK groupe_scolaire | |
| nom | VARCHAR(120) | |
| sigle | VARCHAR(20) | |
| pole | ENUM('ESSIG','UPSS','CFPA','CICI') | extensible |
| regime | ENUM('LMD','CLASSIQUE') | défaut du régime des niveaux de l'école |
| logo, contacts, email | VARCHAR | |

*(L'année scolaire ne figure plus sur `ecole` — elle cadre les inscriptions, paiements, mouvements.)*

#### `annee_scolaire`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| libelle | VARCHAR(9) | ex. `2025-2026`, UNIQUE |
| date_debut | DATE | |
| date_fin | DATE | |
| est_courante | BOOL | une seule à `TRUE` |

#### `modalite_formation`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| code | ENUM('FI','FC','FL','FT') | Formation Initiale / Continue / (à préciser) / (à préciser) |
| libelle | VARCHAR(60) | |

> **Point ouvert mineur :** signification exacte de `FL` et `FT` à confirmer avec le service scolarité (n'impacte pas la structure).

#### `niveau`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| ecole_id | FK ecole | chaque pôle a ses niveaux |
| code | VARCHAR(10) | `L1`,`L2`,`L3`,`M1`,`M2`,`1A`,`2A` |
| libelle | VARCHAR(60) | |
| ordre | INT | progression (1,2,3…) |
| credits_requis | INT NULL | 60 en LMD ; `NULL` en classique |
| a_soutenance | BOOL | |
| a_examen_national | BOOL | |
| UNIQUE | (ecole_id, code) | |

#### `filiere`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| ecole_id | FK ecole | |
| nom | VARCHAR(80) | ex. « Gestion Administrative et Commerciale » |
| sigle | VARCHAR(15) | `GACO`,`GEA`,`AEML`,`QHSE`,`RGI`,`SANTE`,`IC` |
| UNIQUE | (ecole_id, sigle) | |

#### `option_filiere`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| filiere_id | FK filiere | |
| nom | VARCHAR(80) | |
| sigle | VARCHAR(15) | `CI`,`TCM`,`GRH`,`SI`,`MQSS`… (peut être vide pour CFPA) |
| UNIQUE | (filiere_id, sigle) | |

#### `classe`
Concrétise la promotion dans laquelle un étudiant s'inscrit une année donnée.
| colonne | type | notes |
|---|---|---|
| id | PK | |
| annee_scolaire_id | FK annee_scolaire | |
| niveau_id | FK niveau | |
| option_filiere_id | FK option_filiere | |
| modalite_formation_id | FK modalite_formation | |
| libelle_auto | VARCHAR(120) | généré : `L1 GACO/CI FI 2025-2026` |
| effectif_max | INT NULL | |
| UNIQUE | (annee_scolaire_id, niveau_id, option_filiere_id, modalite_formation_id) | |

#### `matiere`
La maquette pédagogique par (niveau × option × semestre).
| colonne | type | notes |
|---|---|---|
| id | PK | |
| niveau_id | FK niveau | |
| option_filiere_id | FK option_filiere | |
| semestre | ENUM('S1','S2') | |
| nom | VARCHAR(120) | |
| code | VARCHAR(20) | |
| coefficient | INT | |
| credits | INT NULL | `NULL` si niveau non-LMD |
| volume_horaire | INT | heures |
| UNIQUE | (niveau_id, option_filiere_id, semestre, code) | |

> Les maquettes évoluent rarement. Si un versionnage par année devient nécessaire, ajouter
> `annee_scolaire_id` à `matiere` dans une itération ultérieure.

#### `periode`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| annee_scolaire_id | FK annee_scolaire | |
| numero | INT | 1 ou 2 |
| libelle | VARCHAR(40) | `Semestre 1` |
| date_debut, date_fin | DATE | |
| UNIQUE | (annee_scolaire_id, numero) | |

#### `session_examen`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| periode_id | FK periode | |
| type | ENUM('NORMALE','RATTRAPAGE') | |
| date_debut, date_fin | DATE | |
| UNIQUE | (periode_id, type) | |

---

### Module 2 — Personnes & inscriptions

#### `etudiant`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| matricule | VARCHAR(20) | UNIQUE au niveau groupe, stable inter-années |
| numero_interne_archive | VARCHAR(20) NULL | « N° INTERNE (ARCHIVE) » de la fiche |
| nom | VARCHAR(60) | |
| prenoms | VARCHAR(120) | |
| sexe | ENUM('M','F') | |
| date_naissance | DATE | |
| lieu_naissance | VARCHAR(120) | |
| nationalite | VARCHAR(60) | |
| email | VARCHAR(120) NULL | |
| telephone | VARCHAR(40) NULL | |
| adresse | VARCHAR(255) NULL | |
| photo | VARCHAR(255) NULL | |
| situation_matrimoniale | ENUM('CELIBATAIRE','MARIE','AUTRE') NULL | |

#### `affiliation`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| etudiant_id | FK etudiant, ON DELETE CASCADE | |
| type | ENUM('PERE','MERE','TUTEUR') | |
| nom | VARCHAR(60) | |
| prenom | VARCHAR(120) | |
| contact | VARCHAR(60) | |
| profession | VARCHAR(120) NULL | |
| UNIQUE | (etudiant_id, type) | |

#### `situation_bac`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| etudiant_id | FK etudiant, UNIQUE | 1:0..1 |
| a_le_bac | BOOL | |
| annee_obtention | INT NULL | |
| serie | VARCHAR(20) NULL | |
| mention | ENUM('TB','B','AB','P') NULL | |
| etablissement | VARCHAR(150) NULL | |
| ville | VARCHAR(80) NULL | |

#### `inscription`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| etudiant_id | FK etudiant | |
| classe_id | FK classe | |
| ecole_id | FK ecole | dénormalisé depuis `classe → niveau → ecole` (cohérence appli/trigger) ; sert au `numero_ordre` et aux bilans par pôle |
| annee_scolaire_id | FK annee_scolaire | redondant via classe, conservé pour l'indexation |
| numero_ordre | INT | **rang d'inscription dans l'année**, séquentiel (1, 2, 3…), attribué à l'échelle de l'école au fil des inscriptions ; réinitialisé chaque année |
| type | ENUM('INSCRIPTION','REINSCRIPTION') | |
| statut | ENUM('NOUVEAU','ANCIEN') | nouveau/ancien de la fiche |
| etablissement_provenance | VARCHAR(150) NULL | |
| est_boursier | BOOL | défaut `FALSE` |
| cout_scolarite_negocie | DECIMAL(12,0) NULL | surcharge de la grille |
| date_inscription | DATE | |
| etat | ENUM('ACTIVE','ABANDON','EXCLU','DIPLOME') | défaut `ACTIVE` |
| + audit | | |
| UNIQUE | (etudiant_id, annee_scolaire_id) | une inscription par étudiant et par année |
| UNIQUE | (ecole_id, annee_scolaire_id, numero_ordre) | numérotation continue par école et par année |

#### `type_piece`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| code | VARCHAR(30) | `ACTE_NAISSANCE`,`RELEVE_BAC`,`PHOTOS`,`LETTRE_MOTIVATION`,`CERTIF_SCOLARITE`… |
| libelle | VARCHAR(120) | |

#### `piece_dossier`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| inscription_id | FK inscription, ON DELETE CASCADE | |
| type_piece_id | FK type_piece | |
| fournie | BOOL | |
| date_reception | DATE NULL | |
| UNIQUE | (inscription_id, type_piece_id) | |

---

### Module 3 — Scolarité & facturation

#### `modalite_paiement`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| niveau_id | FK niveau | l'école est déduite du niveau |
| annee_scolaire_id | FK annee_scolaire | tarifs révisés chaque année |
| montant_inscription_reinscription | DECIMAL(12,0) | même montant inscription et réinscription |
| nombre_echeance | INT | |
| montant_echeance | DECIMAL(12,0) | |
| montant_total | DECIMAL(12,0) GENERATED | `= montant_inscription_reinscription + nombre_echeance * montant_echeance` |
| UNIQUE | (niveau_id, annee_scolaire_id) | |

Exemple : ESSIG · Licence 1 · 2025-2026 → `105000 + 9 * 70000 = 735000`.

#### `type_frais`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| code | VARCHAR(30) | `TENUE`,`PHOTOCOPIE`,`MUTUELLE`,`JOURNEE_INTEGRATION`,`SOUTENANCE`,`EXAMEN`,`MATIERE_OEUVRE` |
| libelle | VARCHAR(120) | |
| ecole_id | FK ecole NULL | `NULL` = tous les pôles |
| niveau_id | FK niveau NULL | `NULL` = tous les niveaux (ex. `SOUTENANCE` limitée à L3/M2) |
| annee_scolaire_id | FK annee_scolaire NULL | `NULL` = montant stable ; sinon barème par année |
| montant_defaut | DECIMAL(12,0) | |
| obligatoire | BOOL | |
| actif | BOOL | |

#### `frais_inscription`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| inscription_id | FK inscription | |
| type_frais_id | FK type_frais | |
| montant_du | DECIMAL(12,0) | copié de `type_frais.montant_defaut`, ajustable |
| exonere | BOOL | |
| commentaire | VARCHAR(255) NULL | |
| + audit | | |
| UNIQUE | (inscription_id, type_frais_id) | |

`avance` / `reste` / `etat_payement` sont **calculés** par `v_situation_frais` à partir des
encaissements imputés sur la ligne.

#### `echeance`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| inscription_id | FK inscription | |
| numero | INT | 0 = inscription/réinscription, 1..N = mensualités |
| montant_prevu | DECIMAL(12,0) | |
| date_prevue | DATE | |
| pris_en_charge_bourse | BOOL | `TRUE` sur les numéros 1..N si `inscription.est_boursier` |
| + audit | | |
| UNIQUE | (inscription_id, numero) | |

Échéancier généré à la création de l'inscription depuis `modalite_paiement`
(ou `cout_scolarite_negocie` réparti). `montant_regle` / `reste` dérivés.

#### `bourse`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| inscription_id | FK inscription | |
| organisme | VARCHAR(150) | financeur |
| perimetre | ENUM('SCOLARITE_HORS_INSCRIPTION') | extensible |
| montant_couvert | DECIMAL(12,0) | ce que l'organisme doit verser |
| + audit | | |

Suivi de ce que l'organisme doit / a versé via des encaissements de mode `VIREMENT` rattachés à
l'inscription et imputés sur les échéances `pris_en_charge_bourse`.

---

### Module 4 — Encaissements & trésorerie (grand livre unifié)

#### `compte`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| groupe_scolaire_id | FK groupe_scolaire | |
| code | VARCHAR(30) | `CAISSE`,`BANQUE_A`,`BANQUE_B`,`AIRTEL_MONEY`,`PRET`,`MACHINE`,`TENUE_ECOLE` |
| libelle | VARCHAR(120) | |
| type | ENUM('CAISSE','BANQUE','MOBILE_MONEY','VIRTUEL') | |
| numero_bancaire | VARCHAR(40) NULL | |
| banque | VARCHAR(120) NULL | |
| solde_initial | DECIMAL(12,0) | défaut 0 |
| actif | BOOL | |

#### `categorie_mouvement`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| code | VARCHAR(40) | `SCOLARITE`,`FRAIS_ANNEXE`,`SALAIRE_ENSEIGNANT`,`SALAIRE_ADMIN`,`AVANCE_PERSONNEL`,`DEPENSE_FONCTIONNEMENT`,`VIREMENT`,`PRET`,`SUBVENTION_BOURSE`,`AUTRE` |
| libelle | VARCHAR(120) | |
| sens | ENUM('ENTREE','SORTIE','NEUTRE') | `NEUTRE` = virement |

#### `mouvement`
Cœur du grand livre. Toute entrée et toute sortie de fonds y figure.
| colonne | type | notes |
|---|---|---|
| id | PK | |
| compte_id | FK compte | |
| date_operation | DATE | |
| sens | ENUM('DEBIT','CREDIT') | `CREDIT` = entrée sur le compte, `DEBIT` = sortie |
| montant | DECIMAL(12,0) | > 0 |
| categorie_mouvement_id | FK categorie_mouvement | |
| libelle | VARCHAR(255) | |
| piece_reference | VARCHAR(40) NULL | n° reçu / n° pièce |
| ecole_id | FK ecole NULL | imputation analytique (bilan par pôle) |
| annee_scolaire_id | FK annee_scolaire | |
| virement_id | FK virement NULL | lie les deux lignes d'un transfert |
| valide | BOOL | défaut `TRUE` |
| + audit | | |

Index : `(compte_id, date_operation)`, `(annee_scolaire_id, ecole_id, date_operation)`,
`(categorie_mouvement_id, date_operation)`.

#### `virement`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| compte_source_id | FK compte | |
| compte_destination_id | FK compte | |
| montant | DECIMAL(12,0) | |
| date | DATE | |
| motif | VARCHAR(255) | |
| + audit | | |

Produit deux `mouvement` : `DEBIT` sur la source, `CREDIT` sur la destination, tous deux avec
`virement_id` renseigné et catégorie `VIREMENT`.

#### `encaissement`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| inscription_id | FK inscription | |
| date | DATE | |
| montant_total | DECIMAL(12,0) | |
| mode | ENUM('ESPECES','VIREMENT','MOBILE_MONEY','CHEQUE') | |
| compte_id | FK compte | compte crédité |
| mouvement_id | FK mouvement | la ligne `CREDIT` générée |
| recu_numero | VARCHAR(40) | UNIQUE — séquence **globale** (tous pôles, toutes années), gérée par un compteur applicatif |
| + audit | | |

#### `imputation_encaissement`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| encaissement_id | FK encaissement, ON DELETE CASCADE | |
| cible | ENUM('ECHEANCE','FRAIS') | |
| echeance_id | FK echeance NULL | renseigné si `cible = ECHEANCE` |
| frais_inscription_id | FK frais_inscription NULL | renseigné si `cible = FRAIS` |
| montant | DECIMAL(12,0) | |
| CONTRAINTE | `Σ montant = encaissement.montant_total` | vérifiée applicativement / trigger |
| CONTRAINTE | exactement une des deux FK non nulle selon `cible` | |

**Règle d'imputation (D15) :** si l'utilisateur ne ventile pas explicitement, l'imputation est
générée automatiquement en FIFO sur les `echeance` impayées de l'inscription (numéro croissant).
Les frais annexes ne sont jamais imputés automatiquement : ils exigent un encaissement dédié.

#### `depense`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| date | DATE | |
| categorie_mouvement_id | FK categorie_mouvement | |
| beneficiaire | VARCHAR(150) | |
| designation | VARCHAR(255) | |
| montant | DECIMAL(12,0) | |
| compte_id | FK compte | compte débité |
| mouvement_id | FK mouvement | ligne `DEBIT` générée |
| ecole_id | FK ecole NULL | |
| annee_scolaire_id | FK annee_scolaire | |
| piece_justificative | VARCHAR(255) NULL | |
| engage_par | FK utilisateur | |
| valide_par | FK utilisateur NULL | |
| + audit | | |

#### `arrete_caisse`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| compte_id | FK compte | typiquement un compte de type `CAISSE` |
| date | DATE | |
| solde_theorique | DECIMAL(12,0) | dérivé de `v_solde_compte` à la date |
| solde_physique | DECIMAL(12,0) | saisi (somme du billetage) |
| ecart | DECIMAL(12,0) GENERATED | `solde_physique - solde_theorique` |
| fait_par | FK utilisateur | |
| + audit | | |

#### `billetage`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| arrete_caisse_id | FK arrete_caisse, ON DELETE CASCADE | |
| denomination | INT | 10000, 5000, 2000, 1000, 500, … |
| quantite | INT | |
| montant | DECIMAL(12,0) GENERATED | `denomination * quantite` |
| UNIQUE | (arrete_caisse_id, denomination) | |

---

### Module 5 — RH & paie

#### `enseignant`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| nom | VARCHAR(60) | |
| prenom | VARCHAR(120) | |
| telephone | VARCHAR(60) NULL | plusieurs numéros possibles → texte libre |
| email | VARCHAR(120) NULL | UNIQUE si non nul |
| specialite | VARCHAR(120) NULL | |
| statut | ENUM('VACATAIRE','PERMANENT') | |
| taux_horaire | DECIMAL(12,0) NULL | défaut pour les affectations |
| actif | BOOL | |
| INDEX | (nom, prenom) | |

#### `personnel_administratif`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| nom | VARCHAR(60) | |
| prenom | VARCHAR(120) | |
| poste | VARCHAR(120) | DAF, Directeur des études, Directrice CFPA, Surveillant Général, Technicienne de surface, Gardien, Secrétaire… |
| ecole_id | FK ecole NULL | `NULL` = niveau groupe |
| telephone | VARCHAR(60) NULL | |
| email | VARCHAR(120) NULL | |
| salaire_base | DECIMAL(12,0) | |
| date_embauche | DATE NULL | |
| actif | BOOL | |

#### `affectation_enseignement`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| enseignant_id | FK enseignant | |
| matiere_id | FK matiere | |
| classe_id | FK classe | |
| annee_scolaire_id | FK annee_scolaire | redondant via classe, indexation |
| volume_horaire_prevu | INT | |
| taux_horaire | DECIMAL(12,0) | |
| montant_prevu | DECIMAL(12,0) GENERATED | `volume_horaire_prevu * taux_horaire` |
| UNIQUE | (matiere_id, classe_id) | une matière d'une classe = un seul enseignant (co-enseignement non autorisé, D9-P2) |

#### `salaire_enseignant`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| enseignant_id | FK enseignant | |
| affectation_enseignement_id | FK affectation_enseignement NULL | ventilation matière/niveau/école |
| annee_scolaire_id | FK annee_scolaire | |
| mois | ENUM('SEPT','OCT','NOV','DEC','JAN','FEV','MAR','AVR','MAI','JUIN','JUIL','AOUT') | |
| date_paiement | DATE | |
| montant | DECIMAL(12,0) | |
| compte_id | FK compte | source |
| mouvement_id | FK mouvement | ligne `DEBIT` |
| + audit | | |

#### `salaire_administration`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| personnel_administratif_id | FK personnel_administratif | |
| annee_scolaire_id | FK annee_scolaire | |
| mois | ENUM(...) | idem |
| date_paiement | DATE | |
| montant_du | DECIMAL(12,0) | = `salaire_base` au moment du paiement |
| montant_paye | DECIMAL(12,0) | |
| compte_id | FK compte | |
| mouvement_id | FK mouvement | |
| + audit | | |
| UNIQUE | (personnel_administratif_id, annee_scolaire_id, mois) | |

`reste` = `montant_du - montant_paye - Σ avances régularisées` → vue.

#### `avance_personnel`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| beneficiaire | ENUM('ENSEIGNANT','ADMIN') | |
| enseignant_id | FK enseignant NULL | selon `beneficiaire` |
| personnel_administratif_id | FK personnel_administratif NULL | selon `beneficiaire` |
| date | DATE | |
| montant | DECIMAL(12,0) | |
| motif | VARCHAR(255) NULL | |
| compte_id | FK compte | |
| mouvement_id | FK mouvement | ligne `DEBIT` |
| regularise_salaire_admin_id | FK salaire_administration NULL | rattachement lors de la régularisation |
| regularisee | BOOL | |
| + audit | | |

---

### Module 6 — Évaluations & résultats (LMD + classique)

#### `evaluation`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| matiere_id | FK matiere | |
| classe_id | FK classe | |
| session_examen_id | FK session_examen | |
| type | ENUM('CC','EXAMEN','TP','PROJET') | |
| ponderation | DECIMAL(5,2) | % de la note matière ; `Σ ponderation` d'une (matiere, classe, session) = 100 |
| bareme | INT | défaut 20 |
| date | DATE NULL | |
| + audit | | |

#### `note_evaluation`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| evaluation_id | FK evaluation, ON DELETE CASCADE | |
| inscription_id | FK inscription | |
| valeur | DECIMAL(4,2) NULL | sur `bareme` ; `NULL` si absent |
| absent | BOOL | |
| + audit | | |
| UNIQUE | (evaluation_id, inscription_id) | |

Note matière/session = `Σ(valeur_ramenée_sur_20 * ponderation / 100)` → alimente `resultat_matiere`.

#### `resultat_matiere`
Figé après délibération de la session.
| colonne | type | notes |
|---|---|---|
| id | PK | |
| inscription_id | FK inscription | |
| matiere_id | FK matiere | |
| periode_id | FK periode | |
| note_normale | DECIMAL(4,2) NULL | calculée depuis la session `NORMALE` |
| note_rattrapage | DECIMAL(4,2) NULL | calculée depuis la session `RATTRAPAGE` |
| note_retenue | DECIMAL(4,2) | `= max(note_normale, LEAST(note_rattrapage, 10))` (D6) |
| credits | INT NULL | copie de `matiere.credits` ; `NULL` si non-LMD |
| validee | BOOL | `note_retenue >= 10` (D4) |
| credits_acquis | INT NULL | `credits` si `validee` sinon 0 ; `NULL` si non-LMD |
| deliberation_id | FK deliberation NULL | |
| + audit | | |
| UNIQUE | (inscription_id, matiere_id, periode_id) | |

#### `resultat_periode`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| inscription_id | FK inscription | |
| periode_id | FK periode | |
| moyenne_ponderee | DECIMAL(4,2) | `Σ(note_retenue * coefficient) / Σ coefficient` |
| credits_acquis | INT NULL | LMD : `Σ credits_acquis` du semestre ; `NULL` sinon |
| rang | INT NULL | |
| + audit | | |
| UNIQUE | (inscription_id, periode_id) | |

#### `resultat_annuel`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| inscription_id | FK inscription | |
| annee_scolaire_id | FK annee_scolaire | |
| regime | ENUM('LMD','CLASSIQUE') | pilote le calcul et la règle de décision |
| moyenne_annuelle | DECIMAL(4,2) | moyenne des deux semestres (pondérée par coefficients) |
| credits_acquis | INT NULL | LMD uniquement, /60 |
| credits_requis | INT NULL | 60 en LMD |
| dette_credits | INT NULL | `credits_requis - credits_acquis` si passage conditionnel |
| decision | ENUM('ADMIS','ADMIS_CONDITIONNEL','REDOUBLE','EXCLU','AJOURNE') | |
| mention | ENUM('PASSABLE','AB','B','TB') NULL | seuils : `PASSABLE` ≥ 10, `AB` ≥ 12, `B` ≥ 14, `TB` ≥ 16 (sur `moyenne_annuelle`) |
| deliberee_le | DATETIME NULL | |
| deliberee_par | FK utilisateur NULL | |
| + audit | | |
| UNIQUE | (inscription_id) | |

**Règles de décision encodées :**
- `regime = LMD` : `credits_acquis >= 60` → `ADMIS` ; `48 <= credits_acquis < 60` →
  `ADMIS_CONDITIONNEL` (crée les lignes `dette_credit`) ; `< 48` → `REDOUBLE` (D7).
- `regime = CLASSIQUE` : `moyenne_annuelle >= 10` → `ADMIS` ; sinon `REDOUBLE` (D8).
- Passage `ADMIS_CONDITIONNEL` interdit si l'inscription précédente porte une `dette_credit`
  non soldée (D7).

#### `deliberation`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| classe_id | FK classe | |
| session_examen_id | FK session_examen | |
| periode_id | FK periode NULL | `NULL` pour une délibération annuelle |
| date | DATE | |
| president_jury | VARCHAR(150) | |
| statut | ENUM('BROUILLON','VALIDEE') | |
| validee_par | FK utilisateur NULL | |
| + audit | | |

#### `dette_credit`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| inscription_origine_id | FK inscription | l'année où la dette est née |
| matiere_id | FK matiere | matière non validée |
| credits | INT | |
| annee_origine_id | FK annee_scolaire | |
| soldee | BOOL | |
| inscription_solde_id | FK inscription NULL | l'année où la matière a été rattrapée |
| + audit | | |

#### `bulletin`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| inscription_id | FK inscription | |
| periode_id | FK periode NULL | `NULL` = bulletin annuel |
| genere_le | DATETIME | |
| genere_par | FK utilisateur | |
| url_pdf | VARCHAR(255) NULL | |

---

### Transverse — utilisateurs & audit

#### `utilisateur`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| personnel_administratif_id | FK personnel_administratif NULL | lien optionnel vers la fiche RH |
| login | VARCHAR(60) | UNIQUE |
| email | VARCHAR(120) | |
| mot_de_passe_hash | VARCHAR(255) | |
| actif | BOOL | |
| derniere_connexion | DATETIME NULL | |
| cree_le | DATETIME | |

#### `role`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| code | ENUM('COMPTABLE','DAF','DIRECTION','SCOLARITE','LECTURE') | |
| libelle | VARCHAR(80) | |

#### `utilisateur_role`
| colonne | type | notes |
|---|---|---|
| utilisateur_id | FK utilisateur | |
| role_id | FK role | |
| ecole_id | FK ecole NULL | `NULL` = portée groupe |
| PK | (utilisateur_id, role_id, ecole_id) | |

#### `journal_audit`
| colonne | type | notes |
|---|---|---|
| id | PK | |
| utilisateur_id | FK utilisateur | |
| action | ENUM('CREATION','MODIFICATION','SUPPRESSION') | |
| table_cible | VARCHAR(60) | |
| ligne_id | BIGINT | |
| valeurs_avant | JSON NULL | |
| valeurs_apres | JSON NULL | |
| date | DATETIME | |
| ip | VARCHAR(45) NULL | |
| INDEX | (table_cible, ligne_id) , (utilisateur_id, date) | |

---

## 7. Vues et calculs dérivés (à livrer avec le schéma)

| Vue | Description | Remplace dans le classeur |
|---|---|---|
| `v_situation_scolarite` | Par inscription : coût dû (`cout_scolarite_negocie` sinon `modalite_paiement.montant_total`), part à la charge de l'étudiant (inscription seule si boursier), total encaissé imputé scolarité, reste, état (`A_JOUR`/`PARTIEL`/`SOLDE`), prochaine échéance impayée | colonnes « Total versé / Coût / Total restant / Situation » |
| `v_situation_frais` | Par (inscription, type_frais) : dû, payé, reste, état | feuilles `unforme`, `frais des copies` |
| `v_echeancier` | Par échéance : prévu, réglé, reste, en retard (o/n) | colonnes mensuelles `Dates / Somme` |
| `v_solde_compte` | Par compte : `solde_initial + Σ(CREDIT) − Σ(DEBIT)` | « Somme en Banque », « Reste en Caisse » |
| `v_bilan_mensuel` | Par (école, mois, année) : entrées, dépenses, solde | bloc « ENTREES /MOIS », `BILAN TOTAL` |
| `v_bilan_consolide` | Agrégation groupe de `v_bilan_mensuel` | `BILAN TOTAL` |
| `v_etat_scolarite_etudiant` | Fiche imprimable : 11 mensualités + soutenance + reste à payer total | feuilles `recherche Essig / CFPA / UPSS` |
| `v_resultat_matiere` | Application de `max(normale, min(rattrapage,10))`, validation, crédits acquis | — |
| `v_bulletin_periode` | Notes par matière + moyenne pondérée + crédits du semestre | — |
| `v_resultat_annuel` | Moyenne annuelle, crédits /60, dette, décision, mention | — |
| `v_masse_salariale` | Par (école, mois) : salaires enseignants + administration | blocs « SALAIRE ENSEIGNANT / SALAIRE ADMINISTRATION » |
| `v_paie_enseignant` | Par enseignant / année : dû (`Σ affectation.montant_prevu`) vs payé (`Σ salaire_enseignant.montant`) | — |
| `v_arrete_caisse` | Solde théorique vs billetage vs écart à une date | billetage de `BILAN TOTAL` |

---

## 8. Correspondance avec l'existant

### 8.1 Tables de `mlamine.sql` → modèle cible

| `mlamine.sql` | Devient | Remarque |
|---|---|---|
| `annee_scolaire` | `annee_scolaire` | `annee` → `libelle` ; FK par `id`, plus par chaîne |
| `ecole` | `ecole` + `groupe_scolaire` | frais déplacés vers `type_frais` ; `annee_scolaire` retirée |
| `enseignant` | `enseignant` | ajout statut, spécialité, taux |
| `etudiants` | `etudiant` + `inscription` | séparation identité / scolarité annuelle ; `numero_odre` → `inscription.numero_ordre` (rang d'inscription dans l'année, par école) ; placement (école/option/niveau/formation) → `classe` |
| `filieres` | `filiere` | `id_niveau` **supprimé** (filière indépendante du niveau) |
| `formation` | `modalite_formation` | FI/FC/FL/FT ; n'est plus rattachée à l'école |
| `matiere` | `matiere` | rattachée à (niveau, option, semestre) ; `credits` ajouté |
| `modalites_payement` | `modalite_paiement` | clé (niveau, année) ; `total` généré |
| `mutuelle_etudiant` | `frais_inscription` (type `MUTUELLE`) | générique |
| `photocopie_etudiant` | `frais_inscription` (type `PHOTOCOPIE`) | générique |
| `uniforme` | `type_frais` (`TENUE`) + barème | |
| `uniforme_etudiant` | `frais_inscription` (type `TENUE`) | |
| `niveaux` | `niveau` | `frais_examen`/`frais_soutenance` → `type_frais` ; `examen`/`soutenance` → `a_examen_national`/`a_soutenance` |
| `options` | `option_filiere` | `id_filiere` conservé |
| `operation_banque_caisse` | `mouvement` + `compte` | l'`ENUM('banque','caisse')` devient des lignes `compte` |
| `depenses` | `depense` (+ `mouvement`) | `compte` texte → FK `compte` ; ajout école, année, catégorie |
| `salaire_enseignant` | `salaire_enseignant` (+ `affectation_enseignement`) | ventilation via l'affectation |
| `versements` | `echeance` + `encaissement` + `imputation_encaissement` | agrégats supprimés ; rattachement à l'inscription |

### 8.2 Feuilles du classeur → modèle cible

| Feuille | Tables / vues |
|---|---|
| `ESSIG` / `ESSS` / `CFPA` | `inscription`, `echeance`, `encaissement` → `v_situation_scolarite`, `v_echeancier` |
| `BILAN ESSIG/UPSS/CFPA` | `v_situation_scolarite` filtrée par pôle |
| `DEPENSES` | `depense`, `salaire_enseignant`, `salaire_administration`, `v_bilan_mensuel` |
| `VERSEMENTS` | `mouvement` (compte banque), `virement` |
| `BILAN TOTAL` | `v_bilan_consolide`, `v_solde_compte`, `v_arrete_caisse`, `billetage` |
| `recherche Essig/CFPA/UPSS` | `v_etat_scolarite_etudiant` |
| `unforme` | `frais_inscription` (TENUE) → `v_situation_frais` |
| `frais des copies` | `frais_inscription` (PHOTOCOPIE) → `v_situation_frais` |
| `Enseignants.xlsx` | `enseignant` (import initial) |
| `inscription pdf.pdf` | `etudiant`, `affiliation`, `situation_bac`, `inscription`, `piece_dossier` |

---

## 9. Points ouverts — résolus

| # | Sujet | Résolution |
|---|---|---|
| P1 | `modalite_formation` FL / FT | Libellés exacts à fournir par le service scolarité au moment du chargement du référentiel. Aucun impact structurel : ce sont des lignes de données. |
| P2 | Co-enseignement | **Non autorisé.** `UNIQUE(matiere_id, classe_id)` maintenue sur `affectation_enseignement`. |
| P3 | Période / échéances | La période académique s'étend d'**octobre à août**. Le nombre d'échéances ne concerne **que la scolarité** et est paramétré par `modalite_paiement.nombre_echeance` (par niveau et par année — ex. 9 pour ESSIG · L1). Les salaires restent sur 12 mois (`SEPT`…`AOUT`), indépendamment. |
| P4 | Bourse partielle | **Supportée.** Le drapeau `echeance.pris_en_charge_bourse` par échéance permet une prise en charge totale (échéances 1..N) ou partielle (sous-ensemble d'échéances). `bourse.montant_couvert` borne l'engagement de l'organisme. |
| P5 | Numérotation des reçus | Séquence **globale** unique sur `encaissement.recu_numero` (tous pôles, toutes années), gérée par un compteur applicatif. |
| P6 | Seuils de mention (`resultat_annuel`) | Validés : `PASSABLE` ≥ 10, `AB` ≥ 12, `B` ≥ 14, `TB` ≥ 16 sur `moyenne_annuelle`. |

---

## 10. Suite

Après validation de ce document : découpage en **plan d'implémentation phasé** (via la compétence
`writing-plans`), dans cet ordre de dépendance :

1. Module 1 (référentiel) + Transverse (utilisateurs) — socle.
2. Module 2 (personnes & inscriptions).
3. Module 3 (scolarité & facturation) + Module 4 (trésorerie) — interdépendants.
4. Module 5 (RH & paie).
5. Module 6 (évaluations & résultats).
6. Vues, jeux de données de migration, contrôles d'intégrité.
