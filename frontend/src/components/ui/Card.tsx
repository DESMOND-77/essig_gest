import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  return <Tag className={cn('surface-card', className)}>{children}</Tag>
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[1.1875rem] leading-snug font-semibold text-[var(--foreground)]">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-4 sm:p-5', className)}>{children}</div>
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  tone = 'brand',
  className,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  icon?: ReactNode
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'accent'
  className?: string
}) {
  const tones = {
    brand: 'bg-[var(--brand-primary-subtle)] text-brand-700',
    success: 'bg-[var(--success-subtle)] text-[var(--success)]',
    warning: 'bg-[var(--warning-subtle)] text-[var(--warning)]',
    danger: 'bg-[var(--destructive-subtle)] text-[var(--destructive)]',
    accent: 'bg-[var(--brand-accent-subtle)] text-accent-700',
  }[tone]

  return (
    <div className={cn('surface-card flex items-start gap-3 p-4', className)}>
      {icon ? (
        <div className={cn('grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)]', tones)}>
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-[0.8125rem] font-medium text-[var(--muted-foreground)]">
          {label}
        </p>
        <p className="numeric mt-1 truncate text-xl font-bold text-[var(--foreground)] sm:text-2xl">
          {value}
        </p>
        {detail ? (
          <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{detail}</p>
        ) : null}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="scroll-slim -mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'control-h inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition',
              active
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={cn(
                  'numeric rounded-full px-1.5 py-0.5 text-[11px]',
                  active ? 'bg-white/20' : 'bg-[var(--surface-muted)]',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
