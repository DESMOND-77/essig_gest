import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/States'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Masqué sous ce breakpoint (table) — la donnée reste dans la carte mobile. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
  align?: 'left' | 'right' | 'center'
  className?: string
  /** Champ identitaire : titre de la carte en mode mobile. */
  primary?: boolean
  sortable?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  caption: string
  loading?: boolean
  error?: Error | null
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  onRowClick?: (row: T) => void
  /** Cartes empilées sous 768px au lieu d'un tableau à défilement horizontal. */
  mobileCards?: boolean
  footer?: ReactNode
  toolbar?: ReactNode
  sort?: { field: string; direction: 'asc' | 'desc' }
  onSortChange?: (field: string) => void
  dense?: boolean
}

const HIDE_BELOW: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}

const ALIGN: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRowClick,
  mobileCards = true,
  footer,
  toolbar,
  sort,
  onSortChange,
  dense,
}: DataTableProps<T>) {
  if (error) {
    return (
      <div className="surface-card overflow-hidden">
        <ErrorState message={error.message} onRetry={onRetry} />
      </div>
    )
  }

  return (
    <div className="surface-card overflow-hidden">
      {toolbar ? (
        <div className="border-b border-[var(--border)] p-3 sm:p-4">{toolbar}</div>
      ) : null}

      {loading ? (
        <TableSkeleton columns={Math.min(columns.length, 5)} />
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <>
          {/* Tableau (tablette / PC) */}
          <div className={cn('table-scroll scroll-slim', mobileCards && 'hidden md:block')}>
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr>
                  {columns.map((column) => {
                    const isSorted = sort?.field === column.key
                    const ariaSort = isSorted
                      ? sort?.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={ariaSort}
                        className={cn(
                          'table-head',
                          ALIGN[column.align ?? 'left'],
                          column.hideBelow && HIDE_BELOW[column.hideBelow],
                          column.className,
                        )}
                      >
                        {column.sortable && onSortChange ? (
                          <button
                            type="button"
                            onClick={() => onSortChange(column.key)}
                            className="inline-flex items-center gap-1 font-semibold uppercase hover:text-[var(--foreground)]"
                          >
                            {column.header}
                            {isSorted ? (
                              sort?.direction === 'asc' ? (
                                <ArrowUp className="size-3" aria-hidden />
                              ) : (
                                <ArrowDown className="size-3" aria-hidden />
                              )
                            ) : null}
                          </button>
                        ) : (
                          column.header
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-brand-50/60',
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'table-cell',
                          dense ? 'py-2' : 'py-3',
                          ALIGN[column.align ?? 'left'],
                          column.hideBelow && HIDE_BELOW[column.hideBelow],
                          column.className,
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartes (mobile) */}
          {mobileCards ? (
            <ul className="divide-y divide-[var(--border)] md:hidden">
              {rows.map((row) => {
                const primary = columns.find((c) => c.primary) ?? columns[0]
                const others = columns.filter((c) => c !== primary)
                return (
                  <li key={rowKey(row)}>
                    <div
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn('p-4', onRowClick && 'cursor-pointer active:bg-brand-50/60')}
                    >
                      <div className="text-base font-semibold text-[var(--foreground)]">
                        {primary.render(row)}
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {others.map((column) => (
                          <div key={column.key} className="min-w-0">
                            <dt className="text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                              {column.header}
                            </dt>
                            <dd className="truncate text-sm text-[var(--foreground)]">
                              {column.render(row)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </>
      )}
      {footer}
    </div>
  )
}

export function Pagination({
  page,
  pageCount,
  total,
  onChange,
  label = 'éléments',
}: {
  page: number
  pageCount: number
  total?: number
  onChange: (page: number) => void
  label?: string
}) {
  if (pageCount <= 1) {
    return total !== undefined ? (
      <p className="px-4 py-3 text-sm text-[var(--muted-foreground)]" aria-live="polite">
        {total} {label}
      </p>
    ) : null
  }
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 sm:px-4">
      <p className="text-sm text-[var(--muted-foreground)]" aria-live="polite">
        Page <span className="font-semibold text-[var(--foreground)]">{page}</span> sur {pageCount}
        {total !== undefined ? ` · ${total} ${label}` : ''}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Page précédente"
          className="grid size-10 place-items-center rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface)] disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Page suivante"
          className="grid size-10 place-items-center rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface)] disabled:opacity-40"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
