/**
 * Contrats de données de l'API `/api/v1` (Django REST Framework).
 * Source de vérité : les serializers et models Django du backend.
 */

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ChampsAudit {
  cree_par: number | null
  cree_le: string
  modifie_par: number | null
  modifie_le: string
}

/* ------------------------------------------------------------------ */
/* Comptes / authentification                                          */
/* ------------------------------------------------------------------ */

export type RoleCode = 'COMPTABLE' | 'DAF' | 'DIRECTION' | 'SCOLARITE' | 'LECTURE'

export interface RoleAffecte {
  code: RoleCode
  ecole_id: number | null
}

export interface Utilisateur {
  id: number
  login: string
  email: string
  roles: RoleAffecte[]
}

/* ------------------------------------------------------------------ */
/* Référentiel                                                         */
/* ------------------------------------------------------------------ */

export type Regime = 'LMD' | 'CLASSIQUE'

export interface Ecole {
  id: number
  nom: string
  sigle: string | null
  regime: Regime
  logo: string | null
  contacts: string | null
  email: string | null
  adresse: string | null
}

export interface AnneeScolaire {
  id: number
  libelle: string
  date_debut: string
  date_fin: string
  est_courante: boolean
}

export interface ModaliteFormation {
  id: number
  code: 'FI' | 'FC' | 'FL' | 'FT'
  libelle: string
}

export interface Niveau {
  id: number
  ecole: number
  ecole_libelle: string
  code: string
  libelle: string
  ordre: number
  credits_requis: number | null
  a_soutenance: boolean
  a_examen_national: boolean
}

export interface Filiere {
  id: number
  ecole: number
  ecole_libelle: string
  nom: string
  sigle: string
}

export interface OptionFiliere {
  id: number
  filiere: number
  filiere_libelle: string
  nom: string
  sigle: string
}

export interface Classe {
  id: number
  annee_scolaire: number
  niveau: number
  option_filiere: number
  modalite_formation: number
  libelle_auto: string
  effectif_max: number | null
}

export interface Matiere {
  id: number
  niveau: number
  niveau_libelle: string
  option_filiere: number
  option_filiere_libelle: string
  semestre: 'S1' | 'S2'
  nom: string
  code: string
  coefficient: number
  credits: number | null
  volume_horaire: number
}

export interface Periode {
  id: number
  annee_scolaire: number
  annee_scolaire_libelle: string
  numero: number
  libelle: string
  date_debut: string
  date_fin: string
}

export interface SessionExamen {
  id: number
  periode: number
  periode_libelle: string
  type: 'NORMALE' | 'RATTRAPAGE'
  date_debut: string | null
  date_fin: string | null
}

/* ------------------------------------------------------------------ */
/* Personnes / scolarité administrative                                */
/* ------------------------------------------------------------------ */

export type Sexe = 'M' | 'F'

export interface Affiliation {
  id: number
  etudiant: number
  type: 'PERE' | 'MERE' | 'TUTEUR'
  nom: string
  prenom: string
  contact: string
  profession: string | null
}

export interface SituationBac {
  id: number
  etudiant: number
  a_le_bac: boolean
  annee_obtention: number | null
  serie: string | null
  mention: 'TB' | 'B' | 'AB' | 'P' | null
  etablissement: string | null
  ville: string | null
}

export interface Etudiant {
  id: number
  matricule: string
  numero_interne_archive: string | null
  nom: string
  prenoms: string
  sexe: Sexe
  date_naissance: string | null
  lieu_naissance: string | null
  nationalite: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  photo: string | null
  situation_matrimoniale: 'CELIBATAIRE' | 'MARIE' | 'AUTRE' | null
  affiliations?: Affiliation[]
  situation_bac?: SituationBac | null
  /** Champ d'écriture uniquement (préfixe du matricule généré). */
  ecole_sigle?: string
}

export interface TypePiece {
  id: number
  code: string
  libelle: string
}

export interface PieceDossier {
  id: number
  inscription: number
  type_piece: number
  fournie: boolean
  date_reception: string | null
}

export type EtatInscription = 'ACTIVE' | 'ABANDON' | 'EXCLU' | 'DIPLOME'

export interface Inscription extends ChampsAudit {
  id: number
  etudiant: number
  etudiant_libelle: string
  classe: number
  classe_libelle: string
  ecole: number
  ecole_libelle: string
  annee_scolaire: number
  numero_ordre: number
  type: 'INSCRIPTION' | 'REINSCRIPTION'
  statut: 'NOUVEAU' | 'ANCIEN'
  etablissement_provenance: string | null
  est_boursier: boolean
  cout_scolarite_negocie: string | number | null
  date_inscription: string
  etat: EtatInscription
  echeances?: Echeance[]
  pieces_dossier?: PieceDossier[]
  frais_inscription?: FraisInscription[]
  bourses?: Bourse[]
}

/* ------------------------------------------------------------------ */
/* Scolarité financière                                                */
/* ------------------------------------------------------------------ */

export interface TypeFrais extends ChampsAudit {
  id: number
  code: string
  libelle: string
  description: string
  ecole: number | null
  niveau: number | null
  annee_scolaire: number | null
  montant_defaut: string | number
  obligatoire: boolean
  actif: boolean
}

export interface FraisInscription extends ChampsAudit {
  id: number
  inscription: number
  type_frais: number
  montant_du: string | number
  exonere: boolean
  commentaire: string | null
}

export type StatutEcheance =
  | 'à payer'
  | 'partiellement payé'
  | 'payé'
  | 'en retard'
  | 'surpaye'

export interface Echeance extends ChampsAudit {
  id: number
  inscription: number
  numero: number
  montant: string | number
  date_echeance: string
  date_paiement: string | null
  montant_paye: string | number
  statut: StatutEcheance
}

export interface Bourse extends ChampsAudit {
  id: number
  etudiant: number
  annee_scolaire: number
  type: 'TOTAL' | 'PARTIELLE' | 'MERITE' | 'SOCIALE'
  pourcentage: string | number | null
  montant_fixe: string | number | null
  date_attribution: string
  date_fin_validite: string | null
}

export interface ModalitePaiement extends ChampsAudit {
  id: number
  niveau: number
  annee_scolaire: number
  montant_inscription_reinscription: string | number
  nombre_echeance: number
  montant_echeance: string | number
  montant_total: string | number
}

/* ------------------------------------------------------------------ */
/* Évaluations et résultats                                            */
/* ------------------------------------------------------------------ */

export interface Evaluation extends ChampsAudit {
  id: number
  matiere: number
  classe: number
  session_examen: number
  type: 'CC' | 'EXAMEN' | 'TP' | 'PROJET'
  ponderation: string | number
  bareme: number
  date: string | null
}

export interface NoteEvaluation extends ChampsAudit {
  id: number
  evaluation: number
  inscription: number
  valeur: string | number | null
  absent: boolean
}

export interface Deliberation extends ChampsAudit {
  id: number
  classe: number
  session_examen: number
  periode: number | null
  date: string
  president_jury: string
  statut: 'BROUILLON' | 'VALIDEE'
  validee_par: number | null
}

export interface ResultatMatiere {
  id: number
  inscription: number
  matiere: number
  periode: number
  note_normale: string | number | null
  note_rattrapage: string | number | null
  note_retenue: string | number
  credits: number | null
  validee: boolean
  credits_acquis: number | null
  deliberation: number | null
}

export interface ResultatPeriode {
  id: number
  inscription: number
  periode: number
  moyenne_ponderee: string | number
  credits_acquis: number | null
  rang: number | null
}

export interface ResultatAnnuel {
  id: number
  inscription: number
  annee_scolaire: number
  regime: 'LMD' | 'CLASSIQUE'
  moyenne_annuelle: string | number
  credits_acquis: number | null
  credits_requis: number | null
  dette_credits: number | null
  decision: 'ADMIS' | 'ADMIS_CONDITIONNEL' | 'REDOUBLE' | 'EXCLU' | 'AJOURNE'
  mention: 'PASSABLE' | 'AB' | 'B' | 'TB' | null
  deliberee_le: string | null
  deliberee_par: number | null
}

export interface DetteCredit {
  id: number
  inscription_origine: number
  matiere: number
  credits: number
  annee_origine: number
  soldee: boolean
  inscription_solde: number | null
}

/* ------------------------------------------------------------------ */
/* Trésorerie                                                          */
/* ------------------------------------------------------------------ */

export interface Compte extends ChampsAudit {
  id: number
  code: string
  libelle: string
  type: 'CAISSE' | 'BANQUE' | 'MOBILE_MONEY' | 'VIRTUEL'
  numero_bancaire: string | null
  banque: string | null
  solde_initial: string | number
  solde_actuel: number
  actif: boolean
}

export interface CategorieMouvement extends ChampsAudit {
  id: number
  code: string
  libelle: string
  sens: 'ENTREE' | 'SORTIE' | 'NEUTRE'
}

export type StatutVirement = 'BROUILLON' | 'EN_ATTENTE_VALIDATION' | 'VALIDE' | 'ANNULE'

export interface Virement extends ChampsAudit {
  id: number
  compte_source: number
  compte_source_code: string
  compte_source_libelle: string
  compte_destination: number
  compte_destination_code: string
  compte_destination_libelle: string
  montant: string | number
  date: string
  motif: string
  statut: StatutVirement
  valide_par: number | null
  valide_par_nom: string | null
}

export interface Mouvement extends ChampsAudit {
  id: number
  compte: number
  compte_code: string
  compte_libelle: string
  date_operation: string
  sens: 'DEBIT' | 'CREDIT'
  montant: string | number
  categorie_mouvement: number
  categorie_mouvement_code: string
  categorie_mouvement_libelle: string
  libelle: string
  piece_reference: string | null
  ecole: number | null
  ecole_nom: string | null
  annee_scolaire: number
  annee_scolaire_libelle: string
  virement: number | null
  virement_id: number | null
  valide: boolean
}

export type StatutEncaissement = 'EN_COURS' | 'VALIDE' | 'ANNULE'

export interface Encaissement extends ChampsAudit {
  id: number
  inscription: number
  inscription_etudiant_nom: string | null
  date: string
  montant_total: string | number
  mode: 'ESPECES' | 'VIREMENT' | 'MOBILE_MONEY' | 'CHEQUE'
  compte: number
  compte_code: string
  compte_libelle: string
  mouvement: number
  recu_numero: string
  statut: StatutEncaissement
}

export interface ImputationEncaissement extends ChampsAudit {
  id: number
  encaissement: number
  encaissement_recu_numero: string
  cible: 'ECHEANCE' | 'FRAIS'
  echeance: number | null
  echeance_numero: number | null
  echeance_montant: string | number | null
  frais_inscription: number | null
  frais_inscription_libelle: string | null
  frais_inscription_montant: string | number | null
  montant: string | number
}

export type StatutDepense = 'ENGAGEE' | 'VALIDEE' | 'PAYEE' | 'ANNULEE'

export interface Depense extends ChampsAudit {
  id: number
  date: string
  categorie_mouvement: number
  categorie_mouvement_code: string
  categorie_mouvement_libelle: string
  beneficiaire: string
  designation: string
  montant: string | number
  compte: number
  compte_code: string
  compte_libelle: string
  ecole: number | null
  ecole_nom: string | null
  annee_scolaire: number
  annee_scolaire_libelle: string
  piece_justificative: string | null
  engage_par: number | null
  engage_par_nom: string | null
  valide_par: number | null
  valide_par_nom: string | null
  statut: StatutDepense
}

export interface ArreteCaisse extends ChampsAudit {
  id: number
  compte: number
  compte_code: string
  compte_libelle: string
  date: string
  solde_theorique: string | number
  solde_physique: string | number
  ecart: string | number
  fait_par: number | null
  fait_par_nom: string | null
  valide_par: number | null
  valide_par_nom: string | null
  statut: 'EN_COURS' | 'VALIDE'
}

export interface Billetage extends ChampsAudit {
  id: number
  arrete_caisse: number
  arrete_caisse_date: string
  arrete_caisse_compte_code: string
  denomination: number
  quantite: number
  montant: string | number
}

/* ------------------------------------------------------------------ */
/* RH & paie                                                           */
/* ------------------------------------------------------------------ */

export interface Enseignant extends ChampsAudit {
  id: number
  nom: string
  prenom: string
  telephone: string | null
  email: string | null
  specialite: string | null
  statut: 'VACATAIRE' | 'PERMANENT'
  taux_horaire: string | number | null
  actif: boolean
}

export interface PersonnelAdministratif extends ChampsAudit {
  id: number
  nom: string
  prenom: string
  poste: string
  ecole: number
  ecole_nom: string | null
  telephone: string | null
  email: string | null
  salaire_base: string | number
  date_embauche: string | null
  actif: boolean
}

export interface AffectationEnseignement extends ChampsAudit {
  id: number
  enseignant: number
  enseignant_nom: string | null
  matiere: number
  matiere_nom: string
  classe: number
  classe_nom: string | null
  annee_scolaire: number
  annee_scolaire_libelle: string
  volume_horaire_prevu: number
  taux_horaire: string | number
  montant_prevu: string | number
}

export type StatutSalaire = 'BROUILLON' | 'VALIDÉ' | 'PAYÉ'

export interface SalaireEnseignant extends ChampsAudit {
  id: number
  enseignant: number
  enseignant_nom: string | null
  affectation_enseignement: number | null
  affectation_enseignement_id: number | null
  annee_scolaire: number
  annee_scolaire_libelle: string
  mois: string
  date_paiement: string
  montant: string | number
  compte: number
  compte_code: string
  compte_libelle: string
  mouvement: number | null
  statut: StatutSalaire
  date_validation: string | null
  valide_par: number | null
  cree_par_nom: string | null
  modifie_par_nom: string | null
}

export interface SalaireAdministration extends ChampsAudit {
  id: number
  personnel_administratif: number
  personnel_administratif_nom: string | null
  annee_scolaire: number
  annee_scolaire_libelle: string
  mois: string
  date_paiement: string
  montant_du: string | number
  montant_paye: string | number
  compte: number
  compte_code: string
  compte_libelle: string
  mouvement: number | null
  statut: StatutSalaire
  date_validation: string | null
  valide_par: number | null
  cree_par_nom: string | null
  modifie_par_nom: string | null
}

export interface AvancePersonnel extends ChampsAudit {
  id: number
  beneficiaire: 'ENSEIGNANT' | 'ADMIN'
  enseignant: number | null
  enseignant_nom: string | null
  personnel_administratif: number | null
  personnel_administratif_nom: string | null
  date: string
  montant: string | number
  motif: string | null
  compte: number
  compte_code: string
  compte_libelle: string
  mouvement: number | null
  regularise_salaire_admin_id: number | null
  regularisee: boolean
  cree_par_nom: string | null
  modifie_par_nom: string | null
}

/* ------------------------------------------------------------------ */
/* Rapports                                                            */
/* ------------------------------------------------------------------ */

export interface TableauDeBord {
  annee_scolaire_id: number | null
  annee_scolaire_libelle: string | null
  etudiants_inscrits: number
  encaissements: number
  reste_a_recouvrer: number
  depenses: number
  solde_comptes: number
  masse_salariale: number
  resultats_par_decision: Record<string, number>
  alertes: {
    echeances_en_retard: number
    arretes_caisse_en_ecart: number
  }
}

export interface SituationScolarite {
  inscription_id: number
  cout_du: number
  part_etudiant: number
  total_encaisse: number
  reste: number
}

export interface EcheancierLigne {
  echeance_id: number
  inscription_id: number
  numero: number
  montant_prevu: number
  date_prevue: string
  montant_regle: number
  reste: number
  en_retard: boolean
}

export interface EtatScolariteEtudiant {
  inscription_id: number
  matricule: string | null
  etudiant: string | null
  cout_du: number
  part_etudiant: number
  total_encaisse: number
  reste_scolarite: number
  reste_frais: number
  reste_total: number
}

export interface SoldeCompte {
  compte_id: number
  code: string
  libelle: string
  type: string
  solde: number
}

export interface BilanMensuel {
  ecole_id: number | null
  annee_scolaire_id: number
  annee: number
  mois: number
  entrees: number
  depenses: number
  solde: number
}

export interface MasseSalariale {
  annee_scolaire_id: number
  mois: string
  montant: number
  ecole_id: number | null
  categorie: 'ENSEIGNANT' | 'ADMIN'
}

export interface PaieEnseignant {
  enseignant_id: number
  annee_scolaire_id: number
  montant_du: number
  montant_paye: number
}

export interface BulletinPeriode {
  inscription_id: number
  periode_id: number
  moyenne_ponderee: number | null
  credits_acquis: number
  nb_matieres: number
  nb_matieres_validees: number
}

export interface SoldeTresorerie {
  [typeCompte: string]: number
}

export interface SoldeParCompte {
  compte_code: string
  compte_libelle: string
  solde: number
}

export interface FluxTresorerie {
  entrants: number
  sortants: number
  net: number
  periode_jours: number
  date_debut: string
  date_fin: string
}

export interface EncaissementRecent {
  id: number
  recu_numero: string
  date: string
  montant_total: number
  mode: string
  etudiant_nom: string
  compte_libelle: string
  statut: string
}

export interface DepenseRecente {
  id: number
  date: string
  montant: number
  beneficiaire: string
  designation: string
  compte_libelle: string
  statut: string
}

export interface EcartCaisse {
  id: number
  date: string
  compte_code: string
  compte_libelle: string
  solde_theorique: number
  solde_physique: number
  ecart: number
  fait_par_nom: string
  valide_par_nom: string
}

export interface PrevisionnelTresorerie {
  solde_actuel: number
  prevision_entrees: number
  prevision_sorties: number
  prevision_flux_net: number
  solde_prevue_fin: number
  periode_jours: number
  date_base: string
  methode: string
}
