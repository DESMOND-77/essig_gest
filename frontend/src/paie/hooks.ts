import { RH_PAIE as P } from '@/api/endpoints'
import { useAll } from '@/lib/hooks'
import type { AffectationEnseignement } from '@/lib/types'

export { RH_PAIE as P } from '@/api/endpoints'

export const MOIS = [
  { value: 'SEPT', label: 'Septembre' },
  { value: 'OCT', label: 'Octobre' },
  { value: 'NOV', label: 'Novembre' },
  { value: 'DEC', label: 'Décembre' },
  { value: 'JAN', label: 'Janvier' },
  { value: 'FEV', label: 'Février' },
  { value: 'MAR', label: 'Mars' },
  { value: 'AVR', label: 'Avril' },
  { value: 'MAI', label: 'Mai' },
  { value: 'JUIN', label: 'Juin' },
  { value: 'JUIL', label: 'Juillet' },
  { value: 'AOUT', label: 'Août' },
]

export const libelleMois: Record<string, string> = Object.fromEntries(
  MOIS.map((mois) => [mois.value, mois.label]),
)

export const libelleStatutSalaire: Record<string, string> = {
  BROUILLON: 'Brouillon',
  'VALIDÉ': 'Validé',
  'PAYÉ': 'Payé',
}

export function moisCourant(): string {
  const mois = new Date().getMonth() + 1
  return MOIS[(mois + 3) % 12]?.value ?? 'SEPT'
}

export function useAffectations(enseignantId?: number | string) {
  return useAll<AffectationEnseignement>(P.affectations, {
    ...(enseignantId ? { enseignant: enseignantId } : {}),
  })
}

export const optionAffectation = (affectation: AffectationEnseignement) =>
  `${affectation.enseignant_nom ?? 'Enseignant'} — ${affectation.matiere_nom} (${
    affectation.classe_nom ?? `Classe #${affectation.classe}`
  })`
