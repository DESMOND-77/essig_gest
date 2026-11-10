import { Compass, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

function PageErreur({
  code,
  titre,
  description,
  icone,
}: {
  code: string
  titre: string
  description: string
  icone: React.ReactNode
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="surface-card max-w-md p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--brand-primary-subtle)] text-brand-700">
          {icone}
        </span>
        <p className="mt-4 text-xs font-bold tracking-[0.2em] text-[var(--muted-foreground)]">
          ERREUR {code}
        </p>
        <h1 className="mt-1 text-xl font-bold">{titre}</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">{description}</p>
        <Link
          to="/"
          className="control-h mt-5 inline-flex items-center rounded-[var(--radius-control)] bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}

export function PageIntrouvable() {
  return (
    <PageErreur
      code="404"
      titre="Page introuvable"
      description="L’adresse demandée n’existe pas ou a été déplacée. Vérifiez le lien depuis la navigation."
      icone={<Compass className="size-7" aria-hidden />}
    />
  )
}

export function PageNonAutorisee() {
  return (
    <PageErreur
      code="403"
      titre="Accès non autorisé"
      description="Votre compte ne dispose pas des droits nécessaires. Contactez la direction pour obtenir le rôle approprié."
      icone={<ShieldAlert className="size-7" aria-hidden />}
    />
  )
}
