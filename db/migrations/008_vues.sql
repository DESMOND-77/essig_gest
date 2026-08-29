-- Migration 008 : Vues de calcul
-- Spec : §7
SET NAMES utf8mb4;

-- 1. Situation de scolarite par inscription
CREATE OR REPLACE VIEW v_situation_scolarite AS
SELECT
  i.id                       AS inscription_id,
  i.etudiant_id,
  i.ecole_id,
  i.annee_scolaire_id,
  i.est_boursier,
  COALESCE(i.cout_scolarite_negocie, mp.montant_total) AS cout_du,
  COALESCE(SUM(CASE WHEN e.pris_en_charge_bourse = 0 THEN e.montant_prevu END), 0) AS part_etudiant,
  COALESCE((
    SELECT SUM(ie.montant)
    FROM imputation_encaissement ie
    JOIN echeance e2 ON e2.id = ie.echeance_id
    WHERE ie.cible = 'ECHEANCE' AND e2.inscription_id = i.id
  ), 0) AS total_encaisse,
  COALESCE(SUM(CASE WHEN e.pris_en_charge_bourse = 0 THEN e.montant_prevu END), 0)
    - COALESCE((
        SELECT SUM(ie.montant)
        FROM imputation_encaissement ie
        JOIN echeance e2 ON e2.id = ie.echeance_id
        WHERE ie.cible = 'ECHEANCE' AND e2.inscription_id = i.id
      ), 0) AS reste,
  CASE
    WHEN COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
                   JOIN echeance e2 ON e2.id = ie.echeance_id
                   WHERE ie.cible='ECHEANCE' AND e2.inscription_id = i.id), 0)
         >= COALESCE(SUM(CASE WHEN e.pris_en_charge_bourse = 0 THEN e.montant_prevu END), 0)
      THEN 'SOLDE'
    WHEN COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
                   JOIN echeance e2 ON e2.id = ie.echeance_id
                   WHERE ie.cible='ECHEANCE' AND e2.inscription_id = i.id), 0) > 0
      THEN 'PARTIEL'
    ELSE 'A_JOUR'
  END AS etat
FROM inscription i
LEFT JOIN modalite_paiement mp
  ON mp.niveau_id = (SELECT c.niveau_id FROM classe c WHERE c.id = i.classe_id)
 AND mp.annee_scolaire_id = i.annee_scolaire_id
LEFT JOIN echeance e ON e.inscription_id = i.id
GROUP BY i.id, i.etudiant_id, i.ecole_id, i.annee_scolaire_id, i.est_boursier,
         COALESCE(i.cout_scolarite_negocie, mp.montant_total);

-- 2. Situation des frais annexes par (inscription, type de frais)
CREATE OR REPLACE VIEW v_situation_frais AS
SELECT
  fi.id            AS frais_inscription_id,
  fi.inscription_id,
  tf.code          AS type_frais,
  fi.montant_du,
  fi.exonere,
  COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
            WHERE ie.cible = 'FRAIS' AND ie.frais_inscription_id = fi.id), 0) AS paye,
  CASE WHEN fi.exonere = 1 THEN 0
       ELSE fi.montant_du - COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
             WHERE ie.cible = 'FRAIS' AND ie.frais_inscription_id = fi.id), 0)
  END AS reste,
  CASE
    WHEN fi.exonere = 1 THEN 'EXONERE'
    WHEN COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
                   WHERE ie.cible='FRAIS' AND ie.frais_inscription_id = fi.id), 0) >= fi.montant_du THEN 'SOLDE'
    WHEN COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
                   WHERE ie.cible='FRAIS' AND ie.frais_inscription_id = fi.id), 0) > 0 THEN 'PARTIEL'
    ELSE 'NON'
  END AS etat
FROM frais_inscription fi
JOIN type_frais tf ON tf.id = fi.type_frais_id;

-- 3. Echeancier detaille
CREATE OR REPLACE VIEW v_echeancier AS
SELECT
  e.id AS echeance_id,
  e.inscription_id,
  e.numero,
  e.montant_prevu,
  e.date_prevue,
  e.pris_en_charge_bourse,
  COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
            WHERE ie.cible = 'ECHEANCE' AND ie.echeance_id = e.id), 0) AS montant_regle,
  e.montant_prevu - COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
            WHERE ie.cible = 'ECHEANCE' AND ie.echeance_id = e.id), 0) AS reste,
  CASE WHEN e.pris_en_charge_bourse = 0
        AND CURRENT_DATE() > e.date_prevue
        AND e.montant_prevu > COALESCE((SELECT SUM(ie.montant) FROM imputation_encaissement ie
              WHERE ie.cible='ECHEANCE' AND ie.echeance_id = e.id), 0)
       THEN 1 ELSE 0 END AS en_retard
FROM echeance e;

-- 4. Solde d'un compte
CREATE OR REPLACE VIEW v_solde_compte AS
SELECT
  c.id AS compte_id,
  c.code,
  c.libelle,
  c.type,
  c.solde_initial
    + COALESCE(SUM(CASE WHEN m.sens = 'CREDIT' THEN m.montant END), 0)
    - COALESCE(SUM(CASE WHEN m.sens = 'DEBIT'  THEN m.montant END), 0) AS solde
FROM compte c
LEFT JOIN mouvement m ON m.compte_id = c.id AND m.valide = 1
GROUP BY c.id, c.code, c.libelle, c.type, c.solde_initial;

-- 5. Bilan mensuel par ecole
CREATE OR REPLACE VIEW v_bilan_mensuel AS
SELECT
  m.ecole_id,
  m.annee_scolaire_id,
  YEAR(m.date_operation)  AS annee,
  MONTH(m.date_operation) AS mois,
  COALESCE(SUM(CASE WHEN cm.sens = 'ENTREE' AND m.sens = 'CREDIT' THEN m.montant END), 0) AS entrees,
  COALESCE(SUM(CASE WHEN cm.sens = 'SORTIE' AND m.sens = 'DEBIT'  THEN m.montant END), 0) AS depenses,
  COALESCE(SUM(CASE WHEN m.sens = 'CREDIT' THEN m.montant ELSE -m.montant END), 0)        AS solde
FROM mouvement m
JOIN categorie_mouvement cm ON cm.id = m.categorie_mouvement_id
WHERE m.valide = 1
GROUP BY m.ecole_id, m.annee_scolaire_id, YEAR(m.date_operation), MONTH(m.date_operation);

-- 6. Bilan consolide groupe
CREATE OR REPLACE VIEW v_bilan_consolide AS
SELECT
  e.groupe_scolaire_id,
  b.annee_scolaire_id,
  b.annee,
  b.mois,
  SUM(b.entrees)  AS entrees,
  SUM(b.depenses) AS depenses,
  SUM(b.solde)    AS solde
FROM v_bilan_mensuel b
JOIN ecole e ON e.id = b.ecole_id
GROUP BY e.groupe_scolaire_id, b.annee_scolaire_id, b.annee, b.mois;

-- 7. Etat de scolarite imprimable (mensualites + soutenance + reste total)
CREATE OR REPLACE VIEW v_etat_scolarite_etudiant AS
SELECT
  i.id AS inscription_id,
  et.matricule,
  CONCAT(et.nom, ' ', et.prenoms) AS etudiant,
  vs.cout_du,
  vs.part_etudiant,
  vs.total_encaisse,
  vs.reste            AS reste_scolarite,
  COALESCE((SELECT SUM(vf.reste) FROM v_situation_frais vf WHERE vf.inscription_id = i.id), 0) AS reste_frais,
  vs.reste + COALESCE((SELECT SUM(vf.reste) FROM v_situation_frais vf WHERE vf.inscription_id = i.id), 0) AS reste_total
FROM inscription i
JOIN etudiant et ON et.id = i.etudiant_id
JOIN v_situation_scolarite vs ON vs.inscription_id = i.id;

-- 8. Resultat par matiere (re-expose la table + regime lisible)
CREATE OR REPLACE VIEW v_resultat_matiere AS
SELECT
  rm.id,
  rm.inscription_id,
  rm.matiere_id,
  rm.periode_id,
  rm.note_normale,
  rm.note_rattrapage,
  rm.note_retenue,
  rm.credits,
  rm.validee,
  rm.credits_acquis,
  CASE WHEN rm.credits IS NULL THEN 'CLASSIQUE' ELSE 'LMD' END AS regime
FROM resultat_matiere rm;

-- 9. Bulletin de periode : moyenne ponderee par (inscription, periode)
CREATE OR REPLACE VIEW v_bulletin_periode AS
SELECT
  rm.inscription_id,
  rm.periode_id,
  ROUND(SUM(rm.note_retenue * mat.coefficient) / NULLIF(SUM(mat.coefficient), 0), 2) AS moyenne_ponderee,
  SUM(COALESCE(rm.credits_acquis, 0)) AS credits_acquis,
  COUNT(*)                            AS nb_matieres,
  SUM(rm.validee)                     AS nb_matieres_validees
FROM resultat_matiere rm
JOIN matiere mat ON mat.id = rm.matiere_id
GROUP BY rm.inscription_id, rm.periode_id;

-- 10. Resultat annuel (re-expose la table)
CREATE OR REPLACE VIEW v_resultat_annuel AS
SELECT
  ra.inscription_id,
  ra.annee_scolaire_id,
  ra.regime,
  ra.moyenne_annuelle,
  ra.credits_acquis,
  ra.credits_requis,
  ra.dette_credits,
  ra.decision,
  ra.mention
FROM resultat_annuel ra;

-- 11. Masse salariale par (ecole, annee, mois)
CREATE OR REPLACE VIEW v_masse_salariale AS
SELECT ecole_id, annee_scolaire_id, mois, SUM(montant) AS montant, 'ENSEIGNANT' AS categorie
FROM (
  SELECT m.ecole_id, se.annee_scolaire_id, se.mois, se.montant
  FROM salaire_enseignant se
  JOIN mouvement m ON m.id = se.mouvement_id
) t
GROUP BY ecole_id, annee_scolaire_id, mois
UNION ALL
SELECT pa.ecole_id, sa.annee_scolaire_id, sa.mois, SUM(sa.montant_paye) AS montant, 'ADMIN' AS categorie
FROM salaire_administration sa
JOIN personnel_administratif pa ON pa.id = sa.personnel_administratif_id
GROUP BY pa.ecole_id, sa.annee_scolaire_id, sa.mois;

-- 12. Paie enseignant : du vs paye
CREATE OR REPLACE VIEW v_paie_enseignant AS
SELECT aff.enseignant_id, aff.annee_scolaire_id,
       SUM(aff.montant_prevu) AS montant_du,
       COALESCE((SELECT SUM(se.montant) FROM salaire_enseignant se
                 WHERE se.enseignant_id = aff.enseignant_id
                   AND se.annee_scolaire_id = aff.annee_scolaire_id), 0) AS montant_paye
FROM affectation_enseignement aff
GROUP BY aff.enseignant_id, aff.annee_scolaire_id;

-- 13. Arrete de caisse : theorique a la date vs billetage vs ecart
CREATE OR REPLACE VIEW v_arrete_caisse AS
SELECT
  ac.id,
  ac.compte_id,
  ac.date,
  ac.solde_theorique,
  ac.solde_physique,
  ac.ecart,
  COALESCE((SELECT SUM(b.montant) FROM billetage b WHERE b.arrete_caisse_id = ac.id), 0) AS total_billetage
FROM arrete_caisse ac;
