import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm disabled:bg-brand-300',
  secondary:
    'bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200 border border-brand-100',
  outline:
    'border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]',
  ghost:
    'text-[var(--foreground)] hover:bg-[var(--surface-muted)] active:bg-[var(--border)]',
  danger:
    'bg-[var(--destructive)] text-white hover:brightness-110 active:brightness-95 shadow-sm',
  success:
    'bg-[var(--success)] text-white hover:brightness-110 active:brightness-95 shadow-sm',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
  icon: 'h-10 w-10 justify-center',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    fullWidth,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'control-h inline-flex items-center rounded-[var(--radius-control)] font-semibold',
        'transition-[background-color,box-shadow,transform] duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
        'disabled:cursor-not-allowed disabled:opacity-70',
        'active:translate-y-px',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
      ) : (
        icon
      )}
      {children ? <span className="truncate">{children}</span> : null}
      {iconRight}
    </button>
  )
})
