import {
  BookOpen,
  CalendarRange,
  ChevronRight,
  GraduationCap,
  Layers,
  LibraryBig,
  School,
  Split,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import {
  useAnnees,
  useClasses,
  useEcoles,
  useFilieres,
  useModalites,
  useNiveaux,
  useOptionsFiliere,
} from './hooks'

const LIENS = [
  {
    to: '/referentiel/ecoles',
    label: 'Écoles',
    description: 'Établissements du groupe, régime LMD ou classique.',
    icon: School,
    compte: 'ecoles' as const,
  },
  {
    to: '/referentiel/annees',
    label: 'Années scolaires',
    description: 'Période académique de référence, une seule année courante.',
    icon: CalendarRange,
    compte: 'annees' as const,
  },
  {
    to: '/referentiel/niveaux',
    label: 'Niveaux',
    description: 'L1, L2… ordre, crédits requis et règles de validation.',
    icon: Layers,
    compte: 'niveaux' as const,
  },
  {
    to: '/referentiel/filieres',
    label: 'Filières',
    description: 'Filières proposées par école et leurs options.',
    icon: GraduationCap,
    compte: 'filieres' as const,
  },
  {
    to: '/referentiel/options',
    label: 'Options de filière',
    description: 'Spécialisations ciblées par les classes et matières.',
    icon: Split,
    compte: 'options' as const,
  },
  {
    to: '/referentiel/modalites',
    label: 'Modalités',
    description: 'Formation initiale, continue, à distance, alternance.',
    icon: BookOpen,
    compte: 'modalites' as const,
  },
]

export function ReferentielPage() {
  const { user } = useAuth()
  const ecoles = useEcoles()
  const annees = useAnnees()
  const niveaux = useNiveaux()
  const classes = useClasses()
  const filieres = useFilieres()
  const options = useOptionsFiliere()
  const modalites = useModalites()

  const comptes: Record<string, number | undefined> = {
    ecoles: ecoles.data?.length,
    annees: annees.data?.length,
    niveaux: niveaux.data?.length,
    filieres: filieres.data?.length,
    options: options.data?.length,
    modalites: modalites.data?.length,
  }

  const anneeCourante = annees.data?.find((annee) => annee.est_courante)

  return (
    <>
      <PageHeader
        title="Référentiel"
        description="Le socle commun : écoles, années, niveaux, filières et modalités. Ces données conditionnent les classes, matières et inscriptions."
        badge={
          anneeCourante ? <Badge tone="success">Année {anneeCourante.libelle}</Badge> : undefined
        }
        actions={
          peutEcrire(user, 'referentiel') ? (
            <Link
              to="/referentiel/annees"
              className="control-h inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm font-semibold hover:bg-[var(--surface-muted)]"
            >
              <LibraryBig className="size-4" aria-hidden />
              Gérer le référentiel
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {LIENS.map((lien) => (
          <Link
            key={lien.to}
            to={lien.to}
            className="surface-card group flex items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[var(--shadow-md)]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-primary-subtle)] text-brand-700">
              <lien.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--foreground)]">{lien.label}</span>
                <ChevronRight
                  className="size-4 shrink-0 text-[var(--muted-foreground)] transition group-hover:translate-x-0.5 group-hover:text-brand-600"
                  aria-hidden
                />
              </span>
              <span className="mt-0.5 block text-sm text-[var(--muted-foreground)]">
                {lien.description}
              </span>
              {comptes[lien.compte] !== undefined ? (
                <span className="numeric mt-2 inline-block text-xs font-semibold text-brand-700">
                  {comptes[lien.compte]} enregistré(s)
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>

      <div className="surface-card mt-4 p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Structure pédagogique</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {classes.data?.length ?? 0} classe(s) active(s) pour{' '}
          {niveaux.data?.length ?? 0} niveau(x) dans {ecoles.data?.length ?? 0} école(s).
          Les classes et matières se gèrent depuis la navigation « Scolarité ».
        </p>
      </div>
    </>
  )
}
