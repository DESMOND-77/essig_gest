/**
 * Miroir frontend du RBAC du backend.
 *
 * Ce n'est qu'une aide à l'interface (masquer ce qui sera refusé, éviter les
 * allers-retours inutiles). La décision finale reste côté Django : chaque
 * ViewSet applique ses propres `permission_classes`.
 */
import type { RoleCode, Utilisateur } from '@/lib/types'

export type DomaineEcriture =
  | 'referentiel'
  | 'referentielPedagogique'
  | 'personnes'
  | 'inscriptions'
  | 'scolariteTarifs'
  | 'scolariteFrais'
  | 'evaluations'
  | 'resultats'
  | 'deliberation'
  | 'tresorerie'
  | 'tresorerieValidation'
  | 'rhPaie'
  | 'rhPaieValidation'

const REGLES: Record<DomaineEcriture, RoleCode[]> = {
  // referentiel/permissions.py — PeutEcrireReferentiel
  referentiel: ['DIRECTION'],
  // referentiel/permissions.py — PeutEcrirePedagogique
  referentielPedagogique: ['DIRECTION', 'SCOLARITE'],
  // personnes/permissions.py — PeutEcrirePersonnes
  personnes: ['DIRECTION', 'SCOLARITE'],
  // personnes/permissions.py — PeutEcrireInscriptions
  inscriptions: ['DIRECTION', 'SCOLARITE'],
  // scolarite/permissions.py — PeutEcrireTarifs
  scolariteTarifs: ['DIRECTION'],
  // scolarite/permissions.py — PeutEcrireFraisEleve
  scolariteFrais: ['DIRECTION', 'DAF', 'COMPTABLE'],
  // evaluations/permissions.py — PeutEcrireEvaluations
  evaluations: ['DIRECTION', 'SCOLARITE'],
  // resultats/permissions.py — PeutEcrireEvaluations
  resultats: ['DIRECTION', 'SCOLARITE'],
  // resultats/permissions.py — PeutValiderDeliberation
  deliberation: ['DIRECTION'],
  // tresorerie/permissions.py — TresoreriePermission (écriture)
  tresorerie: ['COMPTABLE', 'DAF'],
  // tresorerie/permissions.py — TresorerieValidationPermission
  tresorerieValidation: ['COMPTABLE', 'DAF', 'DIRECTION'],
  // rh_paie/permissions.py — RH_PaiePermission (écriture)
  rhPaie: ['COMPTABLE', 'DAF'],
  // rh_paie/permissions.py — RH_PaieValidationPermission
  rhPaieValidation: ['COMPTABLE', 'DAF', 'DIRECTION'],
}

const LECTURE_TRESORERIE_RH: RoleCode[] = [
  'COMPTABLE',
  'DAF',
  'DIRECTION',
  'SCOLARITE',
  'LECTURE',
]

export function codesRoles(user: Utilisateur | null | undefined): RoleCode[] {
  return user?.roles.map((r) => r.code) ?? []
}

export function possedeRole(user: Utilisateur | null | undefined, ...codes: RoleCode[]): boolean {
  const roles = codesRoles(user)
  return codes.some((code) => roles.includes(code))
}

export function peutEcrire(user: Utilisateur | null | undefined, domaine: DomaineEcriture): boolean {
  if (!user) return false
  const autorises = REGLES[domaine]
  return codesRoles(user).some((code) => autorises.includes(code))
}

/** Accès en lecture aux modules financiers (Trésorerie, RH & paie). */
export function peutLireFinances(user: Utilisateur | null | undefined): boolean {
  return possedeRole(user, ...LECTURE_TRESORERIE_RH)
}

export function libelleRole(code: RoleCode): string {
  switch (code) {
    case 'COMPTABLE':
      return 'Comptable'
    case 'DAF':
      return 'Direction administrative et financière'
    case 'DIRECTION':
      return 'Direction'
    case 'SCOLARITE':
      return 'Scolarité'
    case 'LECTURE':
      return 'Lecture seule'
    default:
      return code
  }
}
