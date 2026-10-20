import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Filet de sécurité de dernier recours : une exception de rendu ne doit jamais
 * laisser un écran blanc. Les erreurs métier sont, elles, traitées au niveau
 * des requêtes (ErrorState + toasts).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur de rendu non gérée', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--background)] p-6">
        <div className="surface-card w-full max-w-lg p-6 text-center">
          <p className="text-sm font-semibold tracking-wide text-[var(--destructive)] uppercase">
            Erreur inattendue
          </p>
          <h1 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            L’application n’a pas pu s’afficher
          </h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Vos données sont intactes. Rechargez la page ; si le problème persiste, transmettez le
            message ci-dessous à l’administrateur.
          </p>
          <pre className="scroll-slim mt-4 max-h-40 overflow-auto rounded-lg bg-[var(--surface-muted)] p-3 text-left text-xs text-[var(--muted-foreground)]">
            {error.message}
          </pre>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="control-h inline-flex items-center rounded-[var(--radius-control)] bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Recharger la page
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/'
              }}
              className="control-h inline-flex items-center rounded-[var(--radius-control)] border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--surface-muted)]"
            >
              Retour à l’accueil
            </button>
          </div>
        </div>
      </div>
    )
  }
}
