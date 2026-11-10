import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
} as const

/**
 * Dialogue accessible : rôle `dialog`, focus piégé, `Échap` pour fermer.
 * Sur mobile, il devient une feuille ancrée en bas de l'écran (bottom sheet).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const elements = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null)
      if (elements.length === 0) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="animate-fade-in absolute inset-0 bg-ink-900/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'animate-sheet-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden',
          'rounded-t-[var(--radius-sheet)] bg-[var(--surface)] shadow-[var(--shadow-pop)]',
          'sm:rounded-[var(--radius-card)]',
          SIZES[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-[var(--foreground)]">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-[var(--muted-foreground)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--muted-foreground)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="scroll-slim flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4 pb-[calc(1rem+var(--safe-bottom))] sm:flex-row sm:justify-end sm:pb-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="control-h inline-flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-strong)] px-4 text-sm font-semibold hover:bg-[var(--surface-muted)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'control-h inline-flex items-center justify-center rounded-[var(--radius-control)] px-4 text-sm font-semibold text-white disabled:opacity-70',
              danger ? 'bg-[var(--destructive)]' : 'bg-brand-600 hover:bg-brand-700',
            )}
          >
            {loading ? 'En cours…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-[var(--foreground)]">{message}</div>
    </Dialog>
  )
}
