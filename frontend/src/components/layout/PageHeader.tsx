import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export interface FilArianeItem {
  label: string
  to?: string
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  badge,
  className,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  breadcrumbs?: FilArianeItem[]
  badge?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-6 sm:mb-8', className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Fil d'Ariane" className="mb-2 hidden items-center gap-1 text-sm text-[var(--muted-foreground)] sm:flex">
          {breadcrumbs.map((item, index) => (
            <span key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
              {item.to ? (
                <Link to={item.to} className="hover:text-brand-700 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium text-[var(--foreground)]">
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[1.75rem] leading-tight font-semibold text-[var(--foreground)] sm:text-[2rem]">
              {title}
            </h1>
            {badge}
          </div>
          {description ? (
            <p className="mt-1.5 max-w-[68ch] text-sm text-[var(--muted-foreground)]">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="no-print flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        ) : null}
      </div>
    </header>
  )
}
