# ESSIG Gest — Analyse des écarts vers une gestion complète de l'établissement

_Date : 2026-11-10 · Branche `frontend_review` · HEAD `bc82837` · Périmètre : de l'administration jusqu'aux étudiants._

Ce document recense ce qui manque à ESSIG Gest pour couvrir toute la vie d'un établissement.
Il distingue ce qui est **déjà décidé hors périmètre** (reports volontaires) de ce qui n'a
**jamais été envisagé**. Il ne modifie aucun code et ne tranche aucune règle métier : les
décisions à prendre sont listées en §7.

Méthode : lecture du code (backend, frontend, `db/`, `infra/`), lecture des specs
`docs/superpowers/`, exécution des tests, puis recherche web pour comparer à un SIS complet et
au contexte gabonais. Les points issus de la recherche web sont marqués **à valider**.

---

## 1. État mesuré

| Mesure | Résultat |
|---|---|
| Backend `pytest` | **370 réussis, 16 en échec** (386 tests, 122 s). Exécuté avec le Python 3.14 du venv local ; la CI vise 3.13. |
| Frontend `typecheck` | Propre. |
| Frontend `vitest` | 21 tests réussis, mais 6 fichiers de tests seulement. |
| Taille | 10 apps Django, ≈ 49 modèles concrets, 16 endpoints de rapports, 4 modèles PDF. |

Tests backend en échec (causes **non diagnostiquées**) :

- `comptes/tests/test_auth_jwt.py::test_login_met_a_jour_derniere_connexion`
- `rh_paie/tests/test_api.py` : `test_affectations_endpoint_daf_access`, `test_enseignants_endpoint_daf_access`, `test_enseignants_endpoint_lecture_access`, `test_enseignants_endpoint_no_access`, `test_personnel_administratif_endpoint_daf_access`
- `tresorerie/tests/test_models.py::TresorerieModelsTestCase` : 9 tests de création (arrêté de caisse, billetage, catégorie, compte, dépense, encaissement, imputation, mouvement, virement)
- `tresorerie/tests/test_services.py::TresorerieServicesTestCase::test_effectuer_paiement_salaire_absence_mouvement_orphelin_echec`

Documents de statut devenus inexacts, déplacés le 2026-11-10 dans des dossiers `old/` voisins
(`old/` à la racine, `backend/old/`) :

- `old/TASK_STATUS_SUMMARY.md` annonce le frontend scolarité « non démarré » ; des pages existent.
- `old/ESSIG_GEST_analyse_consolidee_audits_plan_action.md` (14/10) décrit `generer_echeancier` et
  `materialiser_frais_obligatoires` comme des stubs ; ils sont maintenant implémentés
  (`backend/scolarite/services.py:25` et `:87`).
- `backend/old/BACKEND_COMPLETION.md` déclare `derniere_connexion` résolu, mais son test échoue
  (cf. ci-dessus). Le commentaire TODO de `config/settings/base.py` sur ce point reste en place.
- `old/TASK_COMPLETION_SUMMARY.md` (billetage) cite `frontend/src/tresorerie/config/billetage.tsx` et
  `BilletageForm.tsx`, qui n'existent plus.

## 2. Ce qui existe

| Domaine | Backend | Frontend |
|---|---|---|
| Comptes, rôles, audit | JWT, 5 rôles, `JournalAudit` | Connexion, « Mon compte » (lecture seule) |
| Référentiel | École, année, modalité, niveau, filière, option, classe, matière, période, session d'examen | 11 écrans |
| Personnes | Étudiant, affiliations (parents/tuteurs), situation bac, inscription, pièces de dossier, matricule | Étudiants, inscriptions, fiches |
| Scolarité | Grille tarifaire, types de frais, échéances, bourses, échéancier généré | Écrans de grille, échéances, bourses |
| Trésorerie | Comptes, grand livre (`Mouvement`), encaissements, imputations, dépenses, virements, arrêtés de caisse, billetage | Écrans dédiés + tableau de bord |
| RH et paie | Enseignants, personnel administratif, affectations, salaires, avances | 6 écrans |
| Évaluations et résultats | Évaluations, notes, délibérations, résultats matière/période/annuel, dettes de crédits | Évaluations, notes, délibérations, résultats |
| Rapports | 16 endpoints, PDF : reçu, fiche de scolarité, bulletin, état financier | Page rapports + tableau de bord |
| Exploitation | Docker Compose (db, web, Caddy), sauvegarde chiffrée, CI | — |

## 3. Contraintes déjà décidées

Source : `specs/2026-08-30-choix-technologies-sis-design.md` et `specs/2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md` §3.

- **C1** — la v1 est un outil interne ; portail étudiant/parent, notifications, paiement en
  ligne et emploi du temps sont **hors périmètre**.
- **C2** — API-first, réutilisable par une application mobile (6 à 18 mois).
- **C3** — un seul groupe scolaire, ≈ 5 rôles internes, pas de multi-tenant.
- **C4** — développeur unique : privilégier une pile simple.
- **C5** — un VPS unique. **C6** — FCFA entiers. **C7** — MySQL 8.4.
- Écartés « tant qu'aucun besoin réel » : Celery/Redis, SMS/push, temps réel, SSO.
  Condition de réintroduction de Celery : PDF de masse ou imports longs.
- Règle des audits : pas de fausse réussite, aucun stub présenté comme livré.

La majeure partie du §4 est donc un **report volontaire** qui devient un manque dès que C1 est levée.

## 4. Ce qui manque

### P0 — Fondations, avant tout nouveau module

| # | Manque | Constat |
|---|---|---|
| 1 | Administration des comptes | `comptes/urls.py` n'expose que login, refresh, logout, moi. Création d'utilisateurs et attribution de rôles uniquement via l'admin Django ou `seed_socle`. Pas de changement ni de réinitialisation de mot de passe, pas de MFA. |
| 2 | Cloisonnement par école | `UtilisateurRole.ecole` existe et `/moi` le renvoie, mais `_codes()` (`comptes/permissions.py`) l'ignore. Aucune permission ni aucun queryset ne filtre par école. Un rôle SCOLARITE saisi pour une école accède aux données des autres. C3 est à re-trancher puisqu'il y a 3 écoles. |
| 3 | Rôles métier | 5 rôles : COMPTABLE, DAF, DIRECTION, SCOLARITE, LECTURE. Aucun ENSEIGNANT, ÉTUDIANT, PARENT. `Utilisateur` n'est lié ni à `Etudiant` ni à `Enseignant` : prérequis de tout portail. Seuls DIRECTION et SCOLARITE peuvent écrire notes et évaluations. |
| 4 | Audit consultable | `JournalAudit` est alimenté mais ne dispose d'aucune API ni d'aucun écran. |
| 5 | Exploitation | `infra/backup.sh` (mysqldump + age + rclone) : ni planification ni test de restauration constatés. Pas de monitoring ni d'alertes. Pas de tâches asynchrones. Stockage de fichiers local (`django-storages` installé, non utilisé). |
| 6 | Protection des données | Aucun registre des traitements, consentement ni durée de conservation dans le code. Cadre gabonais : loi 001/2011 modifiée par la loi 025/2023, autorité APDPVP (**à valider**). |
| 7 | Décisions finance D5 à D9 | Les audits renvoient annulation et contre-écriture à une décision métier, alors que des actions `annuler` existent sur virement, dépense et arrêté de caisse (`tresorerie/views.py`). À re-valider. |
| 8 | Qualité | 16 tests en échec ; couverture frontend mince (6 fichiers). |

### P1 — Cycle de l'étudiant et documents officiels

| Domaine | Manque |
|---|---|
| Admission | Candidatures, préinscription, concours ou entretien, liste d'attente, conversion candidat → étudiant + inscription. Rien dans le code. |
| Dossier | `PieceDossier` est une case à cocher et `Etudiant.photo` un simple texte : pas de dépôt de fichier. Relances de dossier incomplet (reportées par la spec du modèle de données). |
| Passage et réinscription | Les données existent (`ResultatAnnuel.decision`, `DetteCredit`, `Inscription.Type`) mais aucun workflow ne s'en sert : passage en classe supérieure, redoublement, réinscription en masse, transfert, changement de classe. Abandon, exclusion et diplômé = simple PATCH de `etat`. |
| Présences | Absences, retards, justificatifs, seuils d'alerte : rien. |
| Emploi du temps | Salles, créneaux, calendrier académique, détection de conflits : rien (hors périmètre C1). |
| Suivi pédagogique | Programme, cahier de texte, heures réellement effectuées. `AffectationEnseignement` ne porte que le volume prévu : pas de base de pointage pour les vacations. |
| Délibération | Une inscription à la fois (`DeliberationViewSet.valider`, `resultats/views.py`). Manquent : délibération par classe, PV de jury, classement, sessions de rattrapage planifiées, publication des résultats. |
| Stages et mémoires | Seul le drapeau `Niveau.a_soutenance` existe : pas d'entité stage, mémoire ou jury. |
| Discipline | Rien. |
| Documents officiels | **Existent** : reçu, fiche de scolarité, bulletin, état financier. **Manquent** : attestation de scolarité, relevé de notes, certificat, attestation de réussite, diplôme et supplément au diplôme (LMD/CAMES), carte d'étudiant avec QR, numérotation et vérification d'authenticité, génération en lot, archivage (le stockage binaire a été reporté faute de module Documents). |

### P2 — Finance et RH

| Domaine | Manque |
|---|---|
| Impayés | Les rapports de situation existent ; pas de workflow de relance. |
| Paiement mobile | Airtel Money et Moov Money sont des moyens usuels pour les frais de scolarité au Gabon (**à valider** par établissement). Aucun encaissement mobile ni rapprochement ; les passerelles sont hors périmètre des specs Phase 4 et 5. |
| Échéancier | Régénération après changement du coût négocié ou du statut boursier (report explicite RE-6, spec Phase 3). |
| Bourses et ajustements | Réconciliation avec les organismes de bourse, remboursements, avoirs, pénalités, remises fratrie (hors périmètre Phase 4). |
| Pilotage financier | Budget prévisionnel, clôture périodique, export comptable. L'OHADA est explicitement hors périmètre. |
| Exports | Aucun export Excel/CSV des listes constaté (PDF et imports seulement). |
| Paie | Bulletin de paie et retenues CNSS, CNAMGS, IRPP. Échéances citées par une source : déclarations mensuelles avant le 15, annuelle (DADS) avant le 31 mars. **Les taux divergent selon les sources.** Une source donne 20,1 % employeur et 4,5 % salarié, avec des plafonds CNSS de 1 500 000 et CNAMGS de 2 500 000 XAF/mois ; d'autres sources donnent d'autres chiffres. **À valider auprès de la CNSS et de la DGI avant tout développement.** |
| RH étendue | Contrats, dossier RH, congés, absences du personnel, évaluation (hors périmètre du modèle de données). Remboursement échelonné des avances (D6). |

### P3 — Communication, portails, services optionnels

- **Notifications** : email, SMS, WhatsApp, annonces, messagerie. Aucun backend d'email, aucune tâche asynchrone.
- **Portail étudiant et parent** : notes, solde, échéancier, documents, paiement.
- **Portail enseignant** : ses classes, saisie des notes, appel, emploi du temps.
- **Application mobile** : prévue par C2, non commencée.
- **Services de campus, selon le besoin réel** : bibliothèque, transport, cantine, internat, infirmerie, alumni, insertion professionnelle, intégration LMS, inventaire.
- **Pilotage et tutelle** : tableaux de bord par rôle, indicateurs académiques (réussite, assiduité). Le supérieur privé gabonais est encadré (loi 21/84, évaluations des établissements, commission CESP). Aucune obligation de déclaration précise n'a été trouvée : **à demander à la tutelle**.

## 5. Éléments de comparaison issus de la recherche

- Un guide éditeur (Classter, 2026) liste comme attendus d'un SIS : admissions, carnet de notes,
  présences avec alertes, portails parents/étudiants, reporting, conformité, facturation en
  ligne, intégration LMS, CRM et alumni, sécurité (RBAC, MFA, audit), multi-campus.
- Un éditeur local (Libreville) présente comme socle : inscriptions, emploi du temps avec
  détection de conflits, notes/bulletins/PV, scolarité avec mobile money, portail étudiant avec attestations.
- ESSIG Gest couvre bien notes, bulletins et scolarité ; il manque l'emploi du temps, le
  portail avec attestations et le paiement mobile.
- Limite : ce sont des pages d'éditeurs, pas une norme.

## 6. Ordre suggéré

1. **Stabiliser** : corriger les 16 tests, mettre à jour les documents de statut, tester la restauration de sauvegarde.
2. **Fondations** : gestion des comptes, cloisonnement par école, rôle enseignant, liens `Utilisateur` ↔ `Enseignant` et `Etudiant`, consultation de l'audit.
3. **Documents officiels** : forte valeur, peu de dépendances.
4. **Présences, emploi du temps, heures effectuées** : ils relient la pédagogie à la paie.
5. **Admission, réinscription, passage.**
6. **Notifications et relances d'impayés** : Celery et Redis deviennent alors justifiés.
7. **Portails et paiement mobile.**
8. **Services de campus.**

Les étapes 1 et 2 peuvent démarrer sans décision préalable. Les questions 1 à 4 du §7 doivent
être tranchées avant les portails ou la paie.

## 7. Décisions qui restent à prendre

1. Lever C1 pour ouvrir des portails enseignant, étudiant et parent ? (rôles, protection des données, notifications, hébergement)
2. Cloisonner les données par école, oui ou non ?
3. Quel opérateur ou agrégateur pour le paiement mobile ?
4. Quelles déclarations l'établissement doit-il fournir à la tutelle ?
5. Quels taux et quelles règles pour la paie ?
6. Trancher D5 à D9 (annulation, contre-écriture, remboursement des avances, compte de trésorerie).
7. Quels modèles et mentions pour les documents officiels (LMD/CAMES, arrêté national) ?

## 8. Limites de l'analyse

- Basée sur la lecture du code et des specs et sur l'exécution des tests ; l'application n'a pas été lancée de bout en bout.
- Les 16 échecs de tests ne sont pas diagnostiqués : régression, fixture périmée ou écart de version Python restent à départager.
- Les recherches sur la réglementation gabonaise sont partielles (taux sociaux contradictoires, obligations de la tutelle introuvables).

## Sources

- [Classter — 10 fonctionnalités SIS 2026](https://www.classter.com/blog/edtech/10-must-have-features-in-a-student-information-system-in-2026/)
- [Éditeur local — logiciel pour école supérieure privée à Libreville](https://kolonell.com/fr/blog/logiciel-gestion-ecole-superieure-privee-libreville-prix-2026)
- [Charges employeur au Gabon](https://africarrieres.com/gabon/fr/guide/employeur-entreprise/charges-employeur)
- [CNOU et Airtel Money (e-CNOU)](https://fr.allafrica.com/stories/202603050608.html)
- [Inscriptions UOB entièrement digitalisées](https://www.gabonreview.com/communique-les-inscriptions-a-luniversite-omar-bongo-entierement-digitalisees/)
- [Loi 025/2023 sur la protection des données](https://www.afapdp.org/wp-content/uploads/2023/12/Gabon-Loi-025-2023-du-12-juillet-2023-portant-modification-de-la-loi-001-2011-du-25-septembre-relative-a-la-protection-des-donnees-a-caractere-personnel.pdf)
- [Création des établissements supérieurs privés](https://gabonmediatime.com/gabon-le-gouvernement-clarifie-les-conditions-de-creation-detablissements-prives-superieurs/)
- [Commission pour l'enseignement supérieur privé](https://fr.allafrica.com/stories/202509070248.html)
- [Manuel LMD du CAMES](https://www.lecames.org/wp-content/uploads/2023/11/Manuel_LMD_CAMES.pdf)
