import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function SearchInput({
  value,
  onChange,
  placeholder = 'Rechercher…',
  label = 'Rechercher',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
}) {
  return (
    <div className={cn('relative min-w-0 flex-1 sm:max-w-xs', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="search"
        className="control pl-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Effacer la recherche"
          className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

export function FilterBar({
  children,
  search,
  onReset,
  actifs = 0,
  mobileOpen,
  onToggleMobile,
}: {
  children: ReactNode
  search?: ReactNode
  onReset?: () => void
  actifs?: number
  mobileOpen?: boolean
  onToggleMobile?: () => void
}) {
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        {search}
        {onToggleMobile ? (
          <button
            type="button"
            onClick={onToggleMobile}
            aria-expanded={mobileOpen}
            className="control-h inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm font-semibold md:hidden"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtres
            {actifs > 0 ? (
              <span className="numeric rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] text-white">
                {actifs}
              </span>
            ) : null}
          </button>
        ) : null}
        <div
          className={cn(
            'flex-wrap items-end gap-2 md:flex',
            mobileOpen ? 'flex w-full' : 'hidden',
          )}
        >
          {children}
          {onReset && actifs > 0 ? (
            <button
              type="button"
              onClick={onReset}
              className="control-h inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2 text-sm font-semibold text-brand-700 hover:underline"
            >
              <X className="size-4" aria-hidden />
              Réinitialiser
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Filtre compact (select) utilisé dans les barres d'outils. */
export function SelectFilter({
  label,
  value,
  onChange,
  options,
  allLabel = 'Tous',
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string | number; label: string }[]
  allLabel?: string
  className?: string
}) {
  return (
    <label className={cn('block min-w-0 flex-1 sm:w-48 sm:flex-none', className)}>
      <span className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="control h-10 min-h-10 py-1 text-sm"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
