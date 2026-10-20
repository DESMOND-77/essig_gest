import { ListChecks } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { dateCourte, nombre } from '@/lib/format'
import type { Evaluation } from '@/lib/types'
import {
  optionClasse,
  optionMatiere,
  optionSession,
  useClasses,
  useMatieres,
  useSessions,
  versOptions,
} from '@/referentiel/hooks'

const TYPES = [
  { value: 'CC', label: 'Contrôle continu' },
  { value: 'EXAMEN', label: 'Examen' },
  { value: 'TP', label: 'Travaux pratiques' },
  { value: 'PROJET', label: 'Projet' },
]

export function EvaluationsPage() {
  const { user } = useAuth()
  const classes = useClasses()
  const matieres = useMatieres()
  const sessions = useSessions()

  const champs: FormulaireChamp[] = [
    {
      name: 'classe',
      label: 'Classe',
      type: 'select',
      required: true,
      options: versOptions(classes.data, optionClasse),
    },
    {
      name: 'matiere',
      label: 'Matière',
      type: 'select',
      required: true,
      options: versOptions(matieres.data, optionMatiere),
    },
    {
      name: 'session_examen',
      label: 'Session',
      type: 'select',
      required: true,
      options: versOptions(sessions.data, optionSession),
      colSpan: 2,
    },
    { name: 'type', label: 'Type d’évaluation', type: 'select', required: true, options: TYPES },
    { name: 'date', label: 'Date', type: 'date' },
    {
      name: 'ponderation',
      label: 'Pondération (%)',
      type: 'number',
      required: true,
      min: 0.01,
      max: 100,
      step: 0.01,
      hint: 'La somme des pondérations d’une matière/classe/session ne peut pas dépasser 100 %.',
    },
    {
      name: 'bareme',
      label: 'Barème',
      type: 'number',
      required: true,
      min: 1,
      hint: '20 par défaut.',
    },
  ]

  return (
    <ResourcePage<Evaluation>
      resource="evaluations/evaluations"
      titre="Évaluations"
      description="Devoirs, examens, TP et projets. La pondération répartit le poids de chaque évaluation dans la note de matière."
      singulier="évaluation"
      peutEcrire={peutEcrire(user, 'evaluations')}
      recherche={false}
      defaults={{ bareme: 20, type: 'CC' }}
      filtres={[
        { name: 'classe', label: 'Classe', options: versOptions(classes.data, optionClasse) },
        { name: 'matiere', label: 'Matière', options: versOptions(matieres.data, optionMatiere) },
        {
          name: 'type',
          label: 'Type',
          options: TYPES,
        },
      ]}
      columns={[
        {
          key: 'type',
          header: 'Évaluation',
          primary: true,
          render: (evaluation) => (
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={evaluation.type === 'EXAMEN' ? 'brand' : 'neutral'}>
                {TYPES.find((type) => type.value === evaluation.type)?.label ?? evaluation.type}
              </Badge>
              <span className="text-[var(--muted-foreground)]">
                {matieres.data?.find((matiere) => matiere.id === evaluation.matiere)?.nom ??
                  `Matière #${evaluation.matiere}`}
              </span>
            </span>
          ),
        },
        {
          key: 'classe',
          header: 'Classe',
          render: (evaluation) =>
            classes.data?.find((classe) => classe.id === evaluation.classe)?.libelle_auto ??
            `Classe #${evaluation.classe}`,
        },
        {
          key: 'ponderation',
          header: 'Pondération',
          align: 'right',
          render: (evaluation) => (
            <Badge tone="accent">{nombre(Number(evaluation.ponderation))} %</Badge>
          ),
        },
        {
          key: 'bareme',
          header: 'Barème',
          align: 'right',
          hideBelow: 'md',
          render: (evaluation) => `/${evaluation.bareme}`,
        },
        {
          key: 'date',
          header: 'Date',
          hideBelow: 'lg',
          render: (evaluation) => dateCourte(evaluation.date),
        },
      ]}
      rowActions={(evaluation) => (
        <Link
          to={`/notes?evaluation=${evaluation.id}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-[var(--brand-primary-subtle)]"
        >
          <ListChecks className="size-4" aria-hidden />
          Notes
        </Link>
      )}
      champs={champs}
    />
  )
}
