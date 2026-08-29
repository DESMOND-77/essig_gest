-- phpMyAdmin SQL Dump
-- version 5.2.3deb1
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost:3306
-- Généré le : ven. 28 août 2026 à 17:16
-- Version du serveur : 8.4.10-0ubuntu0.26.04.1
-- Version de PHP : 8.5.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `mlamine`
--

-- --------------------------------------------------------

--
-- Structure de la table `annee_scolaire`
--

CREATE TABLE `annee_scolaire` (
  `id` int NOT NULL,
  `annee` varchar(9) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `depenses`
--

CREATE TABLE `depenses` (
  `compte` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` date DEFAULT NULL,
  `motif` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `montant` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='table de depense des comptes';

-- --------------------------------------------------------

--
-- Structure de la table `ecole`
--

CREATE TABLE `ecole` (
  `nom` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id` int NOT NULL,
  `annee_scolaire` varchar(9) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sigle` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contacts` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `frais_photocopie` decimal(10,2) DEFAULT NULL,
  `frais_mutelle` decimal(10,2) DEFAULT NULL,
  `frais_matiere_oeuvre` decimal(10,2) DEFAULT NULL,
  `frais_journee_integration` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `enseignant`
--

CREATE TABLE `enseignant` (
  `id` int NOT NULL,
  `nom` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prenom` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telephone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `etudiants`
--

CREATE TABLE `etudiants` (
  `id` int NOT NULL,
  `numero_odre` int DEFAULT NULL,
  `matricule` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nom` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prenoms` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_naissance` date DEFAULT NULL,
  `email` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tel` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tel_tuteur` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_ecole` int DEFAULT NULL,
  `id_option` int DEFAULT NULL,
  `id_niveau` int DEFAULT NULL,
  `id_formation` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `filieres`
--

CREATE TABLE `filieres` (
  `id` int NOT NULL,
  `nom` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_niveau` int DEFAULT NULL,
  `sigle` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `formation`
--

CREATE TABLE `formation` (
  `id` int NOT NULL,
  `nom` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_ecole` int DEFAULT NULL,
  `sigle` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `matiere`
--

CREATE TABLE `matiere` (
  `id` int NOT NULL,
  `id_option` int DEFAULT NULL,
  `nom` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `coeff` int DEFAULT NULL,
  `volume_horaire` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `modalites_payement`
--

CREATE TABLE `modalites_payement` (
  `id` int NOT NULL,
  `montant_inscription_reinscription` decimal(10,2) DEFAULT NULL,
  `montant_echeance` decimal(10,2) DEFAULT NULL,
  `nombre_echeance` decimal(10,2) DEFAULT NULL,
  `total` decimal(10,2) DEFAULT NULL,
  `id_niveau` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `mutuelle_etudiant`
--

CREATE TABLE `mutuelle_etudiant` (
  `id` int NOT NULL,
  `id_ecole` int DEFAULT NULL,
  `avance` decimal(10,2) DEFAULT NULL,
  `reste` decimal(10,2) DEFAULT NULL,
  `etat_payement` enum('non','partiel','solde') COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'non'),
  `id_etudiant` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `niveaux`
--

CREATE TABLE `niveaux` (
  `id` int NOT NULL,
  `nom` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_ecole` int DEFAULT NULL,
  `examen` tinyint(1) DEFAULT (0),
  `soutenance` tinyint(1) DEFAULT (0),
  `frais_soutenance` decimal(10,2) DEFAULT NULL,
  `frais_examen` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `operation_banque_caisse`
--

CREATE TABLE `operation_banque_caisse` (
  `id` int NOT NULL,
  `action` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `motif` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `montant` decimal(10,2) NOT NULL,
  `date` date DEFAULT (curdate()),
  `intitule_compte` enum('banque','caisse') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (_utf8mb4'caisse')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `options`
--

CREATE TABLE `options` (
  `id` int NOT NULL,
  `nom` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sigle` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_filiere` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `photocopie_etudiant`
--

CREATE TABLE `photocopie_etudiant` (
  `id` int NOT NULL,
  `id_ecole` int DEFAULT NULL,
  `avance` decimal(10,2) DEFAULT NULL,
  `reste` decimal(10,2) DEFAULT NULL,
  `etat_payement` enum('non','partiel','solde') COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'non'),
  `id_etudiant` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `salaire_enseignant`
--

CREATE TABLE `salaire_enseignant` (
  `id` int NOT NULL,
  `mois` enum('SEPT','OCT','NOV','DEC','JAN','FEV','MAR','AVR','MAI','JUIN','JUI','AOUT') COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'SEPT'),
  `date` date DEFAULT NULL,
  `montant` decimal(10,2) DEFAULT NULL,
  `id_formation` int DEFAULT NULL,
  `id_ecole` int DEFAULT NULL,
  `id_niveau` int DEFAULT NULL,
  `id_matiere` int DEFAULT NULL,
  `id_enseignant` int DEFAULT NULL,
  `source` enum('caisse','banque') COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'caisse')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `uniforme`
--

CREATE TABLE `uniforme` (
  `id` int NOT NULL,
  `nom` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prix` decimal(10,2) DEFAULT NULL,
  `id_ecole` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `uniforme_etudiant`
--

CREATE TABLE `uniforme_etudiant` (
  `id_etudiant` int DEFAULT NULL,
  `avance` decimal(10,2) DEFAULT NULL,
  `reste` decimal(10,2) DEFAULT NULL,
  `id_uniforme` int DEFAULT NULL,
  `etat_payement` enum('non','partiel','solde') COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'non'),
  `id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `versements`
--

CREATE TABLE `versements` (
  `id` int NOT NULL,
  `mois` enum('SEPT','OCT','NOV','DEC','JAN','FEV','MAR','AVR','MAI','JUIN','JUI','AOUT') COLLATE utf8mb4_unicode_ci DEFAULT (_utf8mb4'SEPT'),
  `montant` decimal(10,2) DEFAULT NULL,
  `date` date DEFAULT (curdate()),
  `cout_prevu` decimal(10,2) DEFAULT NULL,
  `totalt_verse` decimal(10,2) DEFAULT NULL,
  `total_restant` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `annee_scolaire`
--
ALTER TABLE `annee_scolaire`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unq_annee_scolaire_annee` (`annee`);

--
-- Index pour la table `ecole`
--
ALTER TABLE `ecole`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ecole_annee_scolaire` (`annee_scolaire`);

--
-- Index pour la table `enseignant`
--
ALTER TABLE `enseignant`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unq_enseignant` (`email`),
  ADD KEY `idx_enseignant` (`nom`,`prenom`);

--
-- Index pour la table `etudiants`
--
ALTER TABLE `etudiants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unq_etudiants_matricule` (`matricule`,`numero_odre`,`nom`),
  ADD KEY `fk_etudiants_ecole` (`id_ecole`),
  ADD KEY `fk_etudiants_niveaux` (`id_niveau`),
  ADD KEY `fk_etudiants_options` (`id_option`),
  ADD KEY `fk_etudiants_formation` (`id_formation`);

--
-- Index pour la table `filieres`
--
ALTER TABLE `filieres`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unq_filieres` (`nom`),
  ADD UNIQUE KEY `unq_filieres_0` (`sigle`),
  ADD KEY `fk_filieres_niveaux` (`id_niveau`);

--
-- Index pour la table `formation`
--
ALTER TABLE `formation`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unq_formation` (`nom`),
  ADD KEY `fk_formation_ecole` (`id_ecole`);

--
-- Index pour la table `matiere`
--
ALTER TABLE `matiere`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unq_matiere` (`nom`),
  ADD KEY `fk_matiere_options` (`id_option`);

--
-- Index pour la table `modalites_payement`
--
ALTER TABLE `modalites_payement`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_modalites_payement_niveaux` (`id_niveau`);

--
-- Index pour la table `mutuelle_etudiant`
--
ALTER TABLE `mutuelle_etudiant`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_photocopie_etudiant_ecole_0` (`id_ecole`),
  ADD KEY `fk_photocopie_etudiant_0` (`id_etudiant`);

--
-- Index pour la table `niveaux`
--
ALTER TABLE `niveaux`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_niveaux_ecole` (`id_ecole`);

--
-- Index pour la table `operation_banque_caisse`
--
ALTER TABLE `operation_banque_caisse`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `options`
--
ALTER TABLE `options`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unq_options` (`sigle`),
  ADD KEY `fk_options_filieres` (`id_filiere`);

--
-- Index pour la table `photocopie_etudiant`
--
ALTER TABLE `photocopie_etudiant`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_photocopie_etudiant_ecole` (`id_ecole`),
  ADD KEY `fk_photocopie_etudiant` (`id_etudiant`);

--
-- Index pour la table `salaire_enseignant`
--
ALTER TABLE `salaire_enseignant`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_salaire_enseignant_ecole` (`id_ecole`),
  ADD KEY `fk_salaire_enseignant` (`id_enseignant`),
  ADD KEY `idx_salaire_enseignant` (`mois`,`id_ecole`),
  ADD KEY `fk_salaire_enseignant_matiere` (`id_matiere`),
  ADD KEY `fk_salaire_enseignant_fomation` (`id_formation`),
  ADD KEY `fk_salaire_enseignant_niveaux` (`id_niveau`);

--
-- Index pour la table `uniforme`
--
ALTER TABLE `uniforme`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_uniforme_ecole` (`id_ecole`);

--
-- Index pour la table `uniforme_etudiant`
--
ALTER TABLE `uniforme_etudiant`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_uniforme_etudiant_uniforme` (`id_uniforme`),
  ADD KEY `fk_uniforme_etudiant_etudiants` (`id_etudiant`);

--
-- Index pour la table `versements`
--
ALTER TABLE `versements`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `versements`
--
ALTER TABLE `versements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `ecole`
--
ALTER TABLE `ecole`
  ADD CONSTRAINT `fk_ecole_annee_scolaire` FOREIGN KEY (`annee_scolaire`) REFERENCES `annee_scolaire` (`annee`);

--
-- Contraintes pour la table `etudiants`
--
ALTER TABLE `etudiants`
  ADD CONSTRAINT `fk_etudiants_ecole` FOREIGN KEY (`id_ecole`) REFERENCES `ecole` (`id`),
  ADD CONSTRAINT `fk_etudiants_formation` FOREIGN KEY (`id_formation`) REFERENCES `formation` (`id`),
  ADD CONSTRAINT `fk_etudiants_niveaux` FOREIGN KEY (`id_niveau`) REFERENCES `niveaux` (`id`),
  ADD CONSTRAINT `fk_etudiants_options` FOREIGN KEY (`id_option`) REFERENCES `options` (`id`);

--
-- Contraintes pour la table `filieres`
--
ALTER TABLE `filieres`
  ADD CONSTRAINT `fk_filieres_niveaux` FOREIGN KEY (`id_niveau`) REFERENCES `niveaux` (`id`);

--
-- Contraintes pour la table `formation`
--
ALTER TABLE `formation`
  ADD CONSTRAINT `fk_formation_ecole` FOREIGN KEY (`id_ecole`) REFERENCES `ecole` (`id`);

--
-- Contraintes pour la table `matiere`
--
ALTER TABLE `matiere`
  ADD CONSTRAINT `fk_matiere_options` FOREIGN KEY (`id_option`) REFERENCES `options` (`id`);

--
-- Contraintes pour la table `modalites_payement`
--
ALTER TABLE `modalites_payement`
  ADD CONSTRAINT `fk_modalites_payement_niveaux` FOREIGN KEY (`id_niveau`) REFERENCES `niveaux` (`id`);

--
-- Contraintes pour la table `mutuelle_etudiant`
--
ALTER TABLE `mutuelle_etudiant`
  ADD CONSTRAINT `fk_photocopie_etudiant_0` FOREIGN KEY (`id_etudiant`) REFERENCES `etudiants` (`id`),
  ADD CONSTRAINT `fk_photocopie_etudiant_ecole_0` FOREIGN KEY (`id_ecole`) REFERENCES `ecole` (`id`);

--
-- Contraintes pour la table `niveaux`
--
ALTER TABLE `niveaux`
  ADD CONSTRAINT `fk_niveaux_ecole` FOREIGN KEY (`id_ecole`) REFERENCES `ecole` (`id`);

--
-- Contraintes pour la table `options`
--
ALTER TABLE `options`
  ADD CONSTRAINT `fk_options_filieres` FOREIGN KEY (`id_filiere`) REFERENCES `filieres` (`id`);

--
-- Contraintes pour la table `photocopie_etudiant`
--
ALTER TABLE `photocopie_etudiant`
  ADD CONSTRAINT `fk_photocopie_etudiant` FOREIGN KEY (`id_etudiant`) REFERENCES `etudiants` (`id`),
  ADD CONSTRAINT `fk_photocopie_etudiant_ecole` FOREIGN KEY (`id_ecole`) REFERENCES `ecole` (`id`);

--
-- Contraintes pour la table `salaire_enseignant`
--
ALTER TABLE `salaire_enseignant`
  ADD CONSTRAINT `fk_salaire_enseignant` FOREIGN KEY (`id_enseignant`) REFERENCES `enseignant` (`id`),
  ADD CONSTRAINT `fk_salaire_enseignant_ecole` FOREIGN KEY (`id_ecole`) REFERENCES `ecole` (`id`),
  ADD CONSTRAINT `fk_salaire_enseignant_fomation` FOREIGN KEY (`id_formation`) REFERENCES `formation` (`id`),
  ADD CONSTRAINT `fk_salaire_enseignant_matiere` FOREIGN KEY (`id_matiere`) REFERENCES `matiere` (`id`),
  ADD CONSTRAINT `fk_salaire_enseignant_niveaux` FOREIGN KEY (`id_niveau`) REFERENCES `niveaux` (`id`);

--
-- Contraintes pour la table `uniforme`
--
ALTER TABLE `uniforme`
  ADD CONSTRAINT `fk_uniforme_ecole` FOREIGN KEY (`id_ecole`) REFERENCES `ecole` (`id`);

--
-- Contraintes pour la table `uniforme_etudiant`
--
ALTER TABLE `uniforme_etudiant`
  ADD CONSTRAINT `fk_uniforme_etudiant_etudiants` FOREIGN KEY (`id_etudiant`) REFERENCES `etudiants` (`id`),
  ADD CONSTRAINT `fk_uniforme_etudiant_uniforme` FOREIGN KEY (`id_uniforme`) REFERENCES `uniforme` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
