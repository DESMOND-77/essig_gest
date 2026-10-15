# Phase 7-8 — Évaluations & Résultats (LMD + Classique) : spécification

## 1. Objectif

Livrer le module 6 du modèle de données
(`docs/superpowers/specs/2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md`
§Module 6, décisions D4/D6/D7/D8/D17) : saisie des notes, calcul des résultats par
matière/période/année, délibérations, gestion de la dette de crédits (LMD). Phase 9
(génération PDF des bulletins) et phase 10 (import de données) restent hors périmètre.

## 2. Périmètre

Dans le périmètre :
- `evaluation`, `note_evaluation` (saisie des notes par type CC/EXAMEN/TP/PROJET,
  pondération, barème).
- `resultat_matiere`, `resultat_periode`, `resultat_annuel`, `deliberation`,
  `dette_credit` — calcul et figeage après délibération.
- API REST + RBAC + audit pour tout ce qui précède.
- Frontend : écrans de saisie des notes, calcul/visualisation des résultats,
  workflow de délibération.

Hors périmètre : génération PDF des bulletins (table `bulletin` créée pour satisfaire
la FK de `v_bulletin_periode` côté SQL de référence mais **pas** exposée côté Django
dans cette phase — aucune génération de document) ; import Excel historique.

## 3. Acteurs

- **SCOLARITE / DIRECTION** : saisissent les évaluations et les notes.
- **DIRECTION** : préside/valide les délibérations (écriture sur `deliberation`,
  déclenche le calcul figé de `resultat_matiere`/`resultat_periode`/`resultat_annuel`).
- **LECTURE, COMPTABLE, DAF** : lecture seule (cohérent avec les autres modules).

Pas de rôle dédié "pédagogie" dans `comptes.models.Role.Code` (5 rôles fixes) : on
réutilise SCOLARITE pour la saisie, DIRECTION pour la validation — même schéma que
`scolarite.permissions.PeutEcrireTarifs`/`PeutEcrireFraisEleve` (`ARole(...)`).

## 4. Règles métier (rappel strict, ne pas réinterpréter)

- **D4** : matière validée si `note_retenue >= 10`.
- **D6** : `note_retenue = max(note_normale, min(note_rattrapage, 10))`. Une seule
  session de rattrapage par semestre.
- **Note matière/session** (D17) : `Σ(valeur_ramenée_sur_20 * ponderation / 100)` sur
  les `note_evaluation` liées à `evaluation(matiere, classe, session_examen)`. Une
  `note_evaluation.valeur = NULL` (absent) exclut la copie du calcul (ne compte pas
  comme 0) — à trancher explicitement dans le plan si ambigu, documenter le choix.
- **Σ pondération** d'une (matière, classe, session) doit valoir 100 — valider à la
  création/modification d'`evaluation` (erreur si dépassement, avertissement ou blocage
  à la dernière évaluation qui porterait le total au-delà de 100).
- **LMD passage annuel (D7)** : `credits_acquis >= 60` → `ADMIS` ; `48..59` →
  `ADMIS_CONDITIONNEL` (crée les lignes `dette_credit` pour chaque matière non validée
  non déjà couverte par une dette existante) ; `< 48` → `REDOUBLE`. Un
  `ADMIS_CONDITIONNEL` est interdit si l'inscription précédente de l'étudiant porte
  encore une `dette_credit` non soldée (D7) → décision forcée à `REDOUBLE` dans ce cas.
- **CFPA classique (D8)** : pas de crédits ; `moyenne_annuelle >= 10` → `ADMIS` ; sinon
  `REDOUBLE`.
- **Mention** (sur `moyenne_annuelle`, les deux régimes) : `PASSABLE >= 10`,
  `AB >= 12`, `B >= 14`, `TB >= 16` ; `NULL` si `moyenne_annuelle < 10`.
- **Figeage** : `resultat_matiere`/`resultat_periode`/`resultat_annuel` ne sont
  calculés/écrits que par l'action de délibération (pas de recalcul live à chaque
  note saisie) — cohérent avec "Figé après délibération" dans la spec design.
- **Dette de crédits** : soldée quand l'étudiant revalide la matière dans une
  inscription ultérieure (lier `inscription_solde_id` lors de la délibération qui
  valide cette matière).

## 5. Données (rappel des tables, cf. `db/migrations/007_evaluations_resultats.sql`
pour les contraintes SQL de référence — les migrations Django sont la source de
vérité de l'application qui tourne, cf. CLAUDE.md)

Champs et contraintes : voir le fichier SQL de référence ci-dessus et le design doc
§Module 6. Repères Django :
- `Matiere.credits` (nullable), `Niveau.credits_requis` (nullable) déjà en place.
- `Ecole.regime` (LMD/CLASSIQUE) pilote le calcul de `resultat_annuel.regime`.
- `Inscription.classe`, `.ecole`, `.annee_scolaire`, `.etudiant` déjà en place.

## 6. API (DRF, conventions `_BaseCrudViewSet` + `AuditableSerializerMixin`)

CRUD standard sur `evaluation`, `note_evaluation`, `dette_credit` (consultation +
écriture via rôle SCOLARITE/DIRECTION). `deliberation` : CRUD + action
`valider/` (POST, rôle DIRECTION) qui déclenche le calcul figé pour sa classe/session
et marque `statut=VALIDEE`. `resultat_matiere`/`resultat_periode`/`resultat_annuel` :
**lecture seule** côté API (générés par la délibération, jamais via POST/PATCH direct).

## 7. Permissions

`evaluations/permissions.py` sur le modèle `ARole` (pas le style dupliqué de
`rh_paie/permissions.py`) :
- `PeutEcrireEvaluations = ARole("SCOLARITE", "DIRECTION")`
- `PeutValiderDeliberation = ARole("DIRECTION")`
- Lecture : tout utilisateur authentifié (cohérent avec les autres modules).

## 8. Audit

`AuditLogMixin` sur tous les ViewSets sensibles (création/modif/suppression de notes,
validation de délibération) — même mécanisme que les autres modules, pas de nouveau
système.

## 9. Validations / erreurs

- `note_evaluation.valeur` : `0 <= valeur <= bareme` (pas juste `<=20`, le barème
  peut différer de 20).
- `evaluation.ponderation` : `0 < ponderation <= 100`.
- Délibération : refuser si des notes manquent pour la session concernée sans `absent=True`
  explicite (erreur 400 listant les inscriptions incomplètes) — décision produit à
  documenter dans le plan si le brief ne tranche pas explicitement (par défaut :
  bloquer, cohérent avec "rapport d'erreur" exigé ailleurs dans le mandat plutôt que
  calculer avec des trous silencieux).

## 10. Tests d'acceptation

- Note retenue = `max(normale, min(rattrapage, 10))` sur des cas limites (rattrapage
  > 10, rattrapage absent, les deux absents).
- Validation matière à exactement 10/20 → validée.
- Passage LMD aux 3 bornes (60, 48, 47 crédits) + cas `ADMIS_CONDITIONNEL` interdit par
  dette non soldée préexistante.
- CFPA : moyenne à 10 pile → admis ; 9.99 → redouble.
- Mention aux 4 seuils (10, 12, 14, 16).
- RBAC : SCOLARITE peut saisir des notes mais pas valider une délibération ; LECTURE
  ne peut rien écrire.
- `v_resultat_matiere`/`v_bulletin_periode`/`v_resultat_annuel` (phase 11) renvoient
  les mêmes valeurs que les tables sources après délibération.

## 11. Hors périmètre (explicite)

PDF des bulletins, import Excel, génération automatique d'un calendrier d'évaluations,
notification des étudiants/parents.
