import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'accent'

const TONES: Record<BadgeTone, string> = {
  neutral:
    'bg-[var(--surface-muted)] text-[var(--muted-foreground)] border-[var(--border-strong)]',
  brand: 'bg-[var(--brand-primary-subtle)] text-brand-800 border-brand-200',
  success: 'bg-[var(--success-subtle)] text-[var(--success)] border-[var(--success)]/30',
  warning: 'bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--warning)]/30',
  danger:
    'bg-[var(--destructive-subtle)] text-[var(--destructive)] border-[var(--destructive)]/30',
  accent: 'bg-[var(--brand-accent-subtle)] text-accent-700 border-accent-200',
}

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  icon?: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  )
}

/** Tonalité associée aux statuts métier renvoyés par l'API. */
export function tonStatut(statut: string | null | undefined): BadgeTone {
  switch ((statut ?? '').toUpperCase()) {
    case 'ACTIVE':
    case 'VALIDE':
    case 'VALIDÉ':
    case 'VALIDEE':
    case 'VALIDÉE':
    case 'PAYÉ':
    case 'PAYEE':
    case 'PAYÉE':
    case 'ADMIS':
    case 'SOLDE':
    case 'PAYE':
    case 'SOLDÉ':
    case 'OUI':
      return 'success'
    case 'BROUILLON':
    case 'EN_COURS':
    case 'EN_ATTENTE_VALIDATION':
    case 'ENGAGEE':
    case 'PARTIEL':
    case 'PARTIELLEMENT PAYÉ':
    case 'ADMIS_CONDITIONNEL':
    case 'À PAYER':
      return 'warning'
    case 'ANNULE':
    case 'ANNULEE':
    case 'ANNULEE':
    case 'ABANDON':
    case 'EXCLU':
    case 'REDOUBLE':
    case 'EN RETARD':
    case 'NON':
      return 'danger'
    case 'DIPLOME':
    case 'AJOURNE':
    case 'SURPAYE':
      return 'brand'
    default:
      return 'neutral'
  }
}
