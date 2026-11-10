/** Formatage localisé (fr-FR) : montants FCFA, dates, pourcentages. */

const nombreFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const decimalFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function nombre(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(numeric)) return '—'
  return nombreFormatter.format(numeric)
}

/** Montant en francs CFA, sans sous-unité (DECIMAL(12,0) côté API). */
export function fcfa(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const formatted = nombre(value)
  return formatted === '—' ? formatted : `${formatted} FCFA`
}

export function decimal(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(numeric)) return '—'
  return decimalFormatter.format(numeric)
}

export function pourcentage(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const numeric = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(numeric)) return '—'
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(numeric)} %`
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  // Une date seule « 2025-10-01 » est interprétée en UTC par `new Date` :
  // on force midi local pour éviter un décalage d'un jour à l'ouest de Greenwich.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const parsed = new Date(dateOnly ? `${value}T12:00:00` : value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function dateCourte(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function dateLongue(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function dateHeure(value: string | Date | null | undefined): string {
  const date = parseDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Date du jour au format attendu par l'API (AAAA-MM-JJ). */
export function aujourdhui(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

export function initiales(nom?: string | null, prenoms?: string | null): string {
  const a = (nom ?? '').trim().charAt(0)
  const b = (prenoms ?? '').trim().charAt(0)
  return `${a}${b}`.toUpperCase() || '?'
}

export function nomComplet(personne?: {
  nom?: string | null
  prenom?: string | null
  prenoms?: string | null
} | null): string {
  if (!personne) return '—'
  return [personne.nom, personne.prenom ?? personne.prenoms].filter(Boolean).join(' ')
}

/** Libellés des mois de paie, dans l'ordre de l'année scolaire. */
export const MOIS_PAIE: { value: string; label: string }[] = [
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

export function libelleMois(code: string | null | undefined): string {
  return MOIS_PAIE.find((m) => m.value === code)?.label ?? '—'
}
