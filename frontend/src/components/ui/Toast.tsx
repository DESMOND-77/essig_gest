import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'danger' | 'info'

interface Toast {
  id: number
  tone: ToastTone
  title: string
  message?: string
}

interface ToastContextValue {
  succes: (title: string, message?: string) => void
  erreur: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONES: Record<ToastTone, { icon: ReactNode; className: string }> = {
  success: {
    icon: <CheckCircle2 className="size-5 text-[var(--success)]" aria-hidden />,
    className: 'border-[var(--success)]/30',
  },
  danger: {
    icon: <AlertTriangle className="size-5 text-[var(--destructive)]" aria-hidden />,
    className: 'border-[var(--destructive)]/30',
  },
  info: {
    icon: <Info className="size-5 text-[var(--info)]" aria-hidden />,
    className: 'border-[var(--info)]/30',
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((tone: ToastTone, title: string, message?: string) => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, tone, title, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 6000)
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      succes: (title, message) => push('success', title, message),
      erreur: (title, message) => push('danger', title, message),
      info: (title, message) => push('info', title, message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="no-print pointer-events-none fixed inset-x-4 bottom-[calc(1rem+var(--safe-bottom))] z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
        role="region"
        aria-label="Notifications"
      >
        <div aria-live="polite" aria-atomic="false" className="flex w-full flex-col gap-2 sm:w-96">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cn(
                'animate-sheet-in pointer-events-auto flex items-start gap-3 rounded-[var(--radius-card)] border bg-[var(--surface)] p-3.5 shadow-[var(--shadow-pop)]',
                TONES[toast.tone].className,
              )}
            >
              <div className="mt-0.5 shrink-0">{TONES[toast.tone].icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--foreground)]">{toast.title}</p>
                {toast.message ? (
                  <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{toast.message}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Fermer la notification"
                onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
                className="grid size-7 shrink-0 place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast doit être utilisé sous <ToastProvider>')
  return context
}
