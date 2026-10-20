import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { useDebounced, usePagedList } from '@/lib/hooks'
import type { QueryParams } from '@/lib/http'
import { cn } from '@/lib/utils'

export interface SearchSelectOption {
  value: number
  label: string
  description?: string
  badge?: string
}

interface SearchSelectProps<T> {
  label: string
  resource: string
  value: number | null | undefined
  onChange: (value: number | null) => void
  toOption: (item: T) => SearchSelectOption
  params?: QueryParams
  placeholder?: string
  searchPlaceholder?: string
  required?: boolean
  error?: string
  hint?: string
  disabled?: boolean
  className?: string
  /** Libellé affiché quand la valeur est déjà connue hors chargement (édition). */
  selectedLabelFallback?: string
}

/**
 * Sélecteur d'entité asynchrone (combobox) : recherche serveur, navigation
 * clavier, annonce des résultats. Utilisé pour étudiants, inscriptions,
 * enseignants… quand les listes dépassent une page.
 */
export function SearchSelect<T>({
  label,
  resource,
  value,
  onChange,
  toOption,
  params,
  placeholder = 'Sélectionner…',
  searchPlaceholder = 'Rechercher…',
  required,
  error,
  hint,
  disabled,
  className,
  selectedLabelFallback,
}: SearchSelectProps<T>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [recherche, setRecherche] = useState('')
  const rechercheDebounced = useDebounced(recherche, 300)
  const [selection, setSelection] = useState<SearchSelectOption | null>(null)
  const [actif, setActif] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const query = usePagedList<T>(resource, {
    ...params,
    ...(rechercheDebounced ? { search: rechercheDebounced } : {}),
  })

  const options = (query.data?.results ?? []).map(toOption)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (selection && value !== selection.value) setSelection(null)
  }, [value, selection])

  const choisir = (option: SearchSelectOption) => {
    setSelection(option)
    onChange(option.value)
    setOpen(false)
    setRecherche('')
  }

  const libelle = selection?.label ?? (value ? selectedLabelFallback : undefined)

  return (
    <div className={cn('min-w-0', className)} ref={containerRef}>
      <label htmlFor={id} className="field-label">
        {label}
        {required ? (
          <span className="ml-1 text-[var(--destructive)]" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'control flex items-center justify-between gap-2 text-left',
            !libelle && 'text-[var(--muted-foreground)]',
          )}
        >
          <span className="truncate">{libelle ?? placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden />
        </button>

        {open ? (
          <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-pop)]">
            <div className="relative border-b border-[var(--border)] p-2">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                aria-hidden
              />
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-expanded="true"
                aria-controls={`${id}-listbox`}
                aria-autocomplete="list"
                value={recherche}
                onChange={(event) => {
                  setRecherche(event.target.value)
                  setActif(0)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActif((index) => Math.min(index + 1, options.length - 1))
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActif((index) => Math.max(index - 1, 0))
                  } else if (event.key === 'Enter') {
                    event.preventDefault()
                    if (options[actif]) choisir(options[actif])
                  }
                }}
                placeholder={searchPlaceholder}
                className="control h-10 min-h-10 py-1 pl-8 text-sm"
              />
            </div>

            <ul id={`${id}-listbox`} role="listbox" className="scroll-slim max-h-64 overflow-y-auto py-1">
              {query.isLoading ? (
                <li className="flex items-center gap-2 px-3 py-3 text-sm text-[var(--muted-foreground)]">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Chargement…
                </li>
              ) : options.length === 0 ? (
                <li className="px-3 py-3 text-sm text-[var(--muted-foreground)]">
                  Aucun résultat.
                </li>
              ) : (
                options.map((option, index) => (
                  <li key={option.value} role="option" aria-selected={value === option.value}>
                    <button
                      type="button"
                      onMouseEnter={() => setActif(index)}
                      onClick={() => choisir(option)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                        index === actif ? 'bg-[var(--brand-primary-subtle)]' : 'hover:bg-[var(--surface-muted)]',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[var(--foreground)]">
                          {option.label}
                        </span>
                        {option.description ? (
                          <span className="block truncate text-xs text-[var(--muted-foreground)]">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                      {option.badge ? (
                        <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold">
                          {option.badge}
                        </span>
                      ) : null}
                      {value === option.value ? (
                        <Check className="size-4 shrink-0 text-brand-600" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                ))
              )}
              {!query.isLoading && query.data && query.data.count > options.length ? (
                <li className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                  {query.data.count} résultats — affinez la recherche.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
      {hint && !error ? <p className="field-hint">{hint}</p> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
