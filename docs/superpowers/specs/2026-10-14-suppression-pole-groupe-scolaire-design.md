# Décision — Suppression des concepts Pôle et Groupe scolaire (2026-10-14)

## Décision (fait autorité, remplace toutes les décisions contraires antérieures)

> ESSIG-GEST ne possède ni entité Groupe scolaire ni entité Pôle. ESSIG, UPSS, CFPA et les
> établissements comparables sont des écoles autonomes. Le régime est une propriété de l'école.

Cette décision est **définitive** : le projet n'étant pas en production, les concepts ont été
supprimés intégralement (schéma SQL, modèles Django, API, frontend), pas seulement masqués ou
renommés.

## Décisions explicitement remplacées

- `docs/superpowers/specs/2026-08-29-modele-donnees-gestion-groupe-scolaire-design.md` — D9
  (multi-entités Groupe scolaire / Pôle / École) **remplacée** par la décision ci-dessus.
- `docs/superpowers/specs/2026-08-30-choix-technologies-sis-design.md` — C3 (« un seul groupe
  scolaire ») **obsolète** : il n'y a plus de notion de groupe scolaire à compter ou limiter.
- `docs/superpowers/plans/2026-09-07-phase-2-personnes-etudiants.md` et
  `.superpowers/.../2026-09-07-phase-2-personnes/progress.md` (décisions D-P2-4, D-P2-7, D-P2-8) —
  le matricule n'est plus généré à partir d'un pôle sélectionné par l'utilisateur mais à partir du
  **sigle de l'école** (voir ci-dessous).

Les autres documents historiques (`2026-08-29-schema-sql-...`, `2026-08-30-socle-applicatif-sis`,
`2026-09-03-phase-1-referentiel-academique-*`) ne sont pas réécrits : ils documentent un état
révolu du modèle et restent lisibles comme tels, supersédés par ce document.

## Modèle cible

`referentiel.Ecole` est désormais une entité autonome portant directement :
`nom`, `sigle`, `regime` (LMD/CLASSIQUE), `logo`, `contacts`, `email`, `adresse`.
Aucune FK vers un groupe scolaire, aucun champ `pole`.

## Matricule étudiant (jugement de conception, non couvert explicitement par le mandat initial)

`personnes.CompteurMatricule` était gardé par `pole` (`PK=pole`, choix fixes ESSIG/UPSS/CFPA/CICI).
Le champ `pole` disparaissant, le compteur est désormais scopé par **sigle d'école**
(`CompteurMatricule.ecole_sigle`, `PK`), et `generer_matricule(ecole_sigle, nom, prenoms)` produit
un matricule au format `<SIGLE_ECOLE>-FCV<INITIALES><N>` (inchangé dans sa forme, change seulement
la source de vérité : le sigle vient de `referentiel.Ecole`, pas d'un enum fixe). Décision validée
avec l'utilisateur avant implémentation.

## Trésorerie

`tresorerie.Compte` perd son FK `groupe_scolaire` : un compte n'est plus rattaché à un
groupement, il existe au niveau du système. La vue `v_bilan_consolide` (SQL) est repensée en
consolidation globale (toutes écoles), au lieu d'un regroupement par `groupe_scolaire_id`.
