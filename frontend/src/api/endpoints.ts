/**
 * Points d'entrée de l'API, regroupés par domaine.
 *
 * Les chaînes sont relatives au préfixe `/api/v1` (déjà ajouté par `lib/http`).
 * Elles servent à la fois à construire les URL (`resourceUrl`) et de clés
 * d'invalidation TanStack Query (`['list', resource]`).
 */

export const AUTH = {
  login: 'auth/login/',
  logout: 'auth/logout/',
  refresh: 'auth/refresh/',
  moi: 'auth/moi/',
} as const

export const REFERENTIEL = {
  ecoles: 'referentiel/ecoles',
  annees: 'referentiel/annees-scolaires',
  modalites: 'referentiel/modalites-formation',
  niveaux: 'referentiel/niveaux',
  filieres: 'referentiel/filieres',
  options: 'referentiel/options-filiere',
  classes: 'referentiel/classes',
  matieres: 'referentiel/matieres',
  periodes: 'referentiel/periodes',
  sessions: 'referentiel/sessions-examen',
} as const

export const PERSONNES = {
  etudiants: 'personnes/etudiants',
  affiliations: 'personnes/affiliations',
  situationBac: 'personnes/situation-bac',
  typesPiece: 'personnes/types-piece',
  inscriptions: 'personnes/inscriptions',
  piecesDossier: 'personnes/pieces-dossier',
} as const

export const SCOLARITE = {
  typesFrais: 'scolarite/types-frais',
  fraisInscription: 'scolarite/frais-inscription',
  bourses: 'scolarite/bourses',
  modalitesPaiement: 'scolarite/modalites-paiement',
  echeances: 'scolarite/echeances',
} as const

export const EVALUATIONS = {
  evaluations: 'evaluations/evaluations',
  notes: 'evaluations/notes',
} as const

export const RESULTATS = {
  deliberations: 'resultats/deliberations',
  dettesCredit: 'resultats/dettes-credit',
  resultatsMatiere: 'resultats/resultats-matiere',
  resultatsPeriode: 'resultats/resultats-periodes',
  resultatsAnnuels: 'resultats/resultats-annuels',
} as const

export const TRESORERIE = {
  comptes: 'tresorerie/comptes',
  categories: 'tresorerie/categories-mouvement',
  virements: 'tresorerie/virements',
  mouvements: 'tresorerie/mouvements',
  encaissements: 'tresorerie/encaissements',
  imputations: 'tresorerie/imputations-encaissement',
  depenses: 'tresorerie/depenses',
  arretes: 'tresorerie/arretes-caisse',
  billetages: 'tresorerie/billetage',
} as const

export const RH_PAIE = {
  enseignants: 'rh-paie/enseignants',
  personnel: 'rh-paie/personnel-administratif',
  affectations: 'rh-paie/affectations-enseignement',
  salairesEnseignants: 'rh-paie/salaires-enseignant',
  salairesAdministration: 'rh-paie/salaires-administration',
  avances: 'rh-paie/avances-personnel',
} as const

export const RAPPORTS = {
  base: 'rapports',
  tableauDeBord: 'rapports/tableau-de-bord',
  echeancier: 'rapports/echeancier',
  situationScolarite: 'rapports/situation-scolarite',
  bilanConsolide: 'rapports/bilan-consolide',
} as const

/** Préfixe absolu : certains traitements (PDF, pièces) sortent du helper. */
export const API_V1 = '/api/v1'
