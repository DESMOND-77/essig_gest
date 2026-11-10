import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden />
}

export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-4" aria-hidden>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn('h-5', colIndex === 0 ? 'w-1/3' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function LoadingState({ label = 'Chargement des données…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" role="status">
      <RefreshCw className="size-6 animate-spin text-brand-500" aria-hidden />
      <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
    </div>
  )
}

export function EmptyState({
  title = 'Aucun résultat',
  description,
  action,
  icon,
}: {
  title?: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-[var(--brand-primary-subtle)] text-brand-600">
        {icon ?? <Inbox className="size-6" aria-hidden />}
      </div>
      <div>
        <p className="font-semibold text-[var(--foreground)]">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({
  title = 'Chargement impossible',
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center" role="alert">
      <div className="grid size-12 place-items-center rounded-2xl bg-[var(--destructive-subtle)] text-[var(--destructive)]">
        <AlertCircle className="size-6" aria-hidden />
      </div>
      <div>
        <p className="font-semibold text-[var(--foreground)]">{title}</p>
        {message ? (
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted-foreground)]">{message}</p>
        ) : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="control-h inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] px-4 text-sm font-semibold hover:bg-[var(--surface-muted)]"
        >
          <RefreshCw className="size-4" aria-hidden />
          Réessayer
        </button>
      ) : null}
    </div>
  )
}

/** Bandeau d'information contextuel (ex. lecture seule, règle métier). */
export function InfoBanner({
  tone = 'info',
  title,
  children,
  icon,
}: {
  tone?: 'info' | 'warning' | 'success'
  title?: string
  children: ReactNode
  icon?: ReactNode
}) {
  const styles = {
    info: 'bg-[var(--info-subtle)] border-[var(--info)]/25 text-brand-900',
    warning: 'bg-[var(--warning-subtle)] border-[var(--warning)]/30 text-[#6b2f06]',
    success: 'bg-[var(--success-subtle)] border-[var(--success)]/30 text-[#0a5b2f]',
  }[tone]
  return (
    <div className={cn('flex items-start gap-3 rounded-[var(--radius-control)] border p-3.5 text-sm', styles)}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title && 'mt-0.5', 'text-[var(--foreground)]/85')}>{children}</div>
      </div>
    </div>
  )
}
