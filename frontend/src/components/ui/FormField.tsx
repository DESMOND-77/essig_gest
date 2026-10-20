import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { cn } from '@/lib/utils'

interface FieldShellProps {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

function FieldShell({ id, label, required, hint, error, children, className }: FieldShellProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="field-label">
        {label}
        {required ? (
          <span className="ml-1 text-[var(--destructive)]" aria-hidden>
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (obligatoire)</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean)
  return ids.length > 0 ? ids.join(' ') : undefined
}

export interface InputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: string
  error?: string
  containerClassName?: string
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { label, hint, error, containerClassName, required, className, ...props },
  ref,
) {
  const generatedId = useId()
  const id = props.name ? `${props.name}-${generatedId}` : generatedId
  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={containerClassName}
    >
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn('control', className)}
        {...props}
      />
    </FieldShell>
  )
})

export interface TextareaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  hint?: string
  error?: string
  containerClassName?: string
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField({ label, hint, error, containerClassName, required, className, ...props }, ref) {
    const generatedId = useId()
    const id = props.name ? `${props.name}-${generatedId}` : generatedId
    return (
      <FieldShell
        id={id}
        label={label}
        required={required}
        hint={hint}
        error={error}
        className={containerClassName}
      >
        <textarea
          ref={ref}
          id={id}
          required={required}
          rows={props.rows ?? 3}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn('control resize-y', className)}
          {...props}
        />
      </FieldShell>
    )
  },
)

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  options: SelectOption[]
  hint?: string
  error?: string
  placeholder?: string
  containerClassName?: string
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, options, hint, error, placeholder, containerClassName, required, className, ...props },
  ref,
) {
  const generatedId = useId()
  const id = props.name ? `${props.name}-${generatedId}` : generatedId
  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={containerClassName}
    >
      <select
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn('control appearance-none bg-no-repeat pr-9', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%235a6a6d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
          backgroundPosition: 'right 0.75rem center',
        }}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
})

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  hint?: string
}

export function CheckboxField({ label, hint, className, ...props }: CheckboxFieldProps) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-4 shrink-0 rounded border-[var(--border-strong)] accent-[var(--brand-primary)]"
        {...props}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-[var(--foreground)]">
          {label}
        </label>
        {hint ? <p className="field-hint">{hint}</p> : null}
      </div>
    </div>
  )
}

/** Groupe de champs sur deux colonnes à partir de la tablette. */
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', className)}>{children}</div>
  )
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-bold tracking-wide text-[var(--muted-foreground)] uppercase">
          {title}
        </h3>
        {description ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}
