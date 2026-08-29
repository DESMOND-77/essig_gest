# Correspondance ancien modèle → schéma cible

Référence pour la reprise des données depuis `mlamine.sql` et `test 2026.xlsx`.
Voir `docs/superpowers/specs/2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md` §8 pour le détail des transformations.

## Tables `mlamine.sql` → cible

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

## Feuilles `test 2026.xlsx` → cible

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
