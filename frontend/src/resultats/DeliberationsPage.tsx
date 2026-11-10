import { BadgeCheck } from 'lucide-react'
import { useState } from 'react'

import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { dateCourte } from '@/lib/format'
import { useAction } from '@/lib/hooks'
import type { Deliberation } from '@/lib/types'
import {
  optionClasse,
  optionPeriode,
  optionSession,
  useClasses,
  usePeriodes,
  useSessions,
  versOptions,
} from '@/referentiel/hooks'

export function DeliberationsPage() {
  const { user } = useAuth()
  const classes = useClasses()
  const sessions = useSessions()
  const periodes = usePeriodes()

  const champs: FormulaireChamp[] = [
    {
      name: 'classe',
      label: 'Classe',
      type: 'select',
      required: true,
      options: versOptions(classes.data, optionClasse),
    },
    {
      name: 'session_examen',
      label: 'Session',
      type: 'select',
      required: true,
      options: versOptions(sessions.data, optionSession),
    },
    {
      name: 'periode',
      label: 'Période',
      type: 'select',
      hint: 'Nécessaire pour figer les résultats de matière.',
      options: versOptions(periodes.data, optionPeriode),
    },
    { name: 'date', label: 'Date de délibération', type: 'date', required: true },
    { name: 'president_jury', label: 'Président du jury', required: true, colSpan: 2 },
  ]

  return (
    <ResourcePage<Deliberation>
      resource="resultats/deliberations"
      titre="Délibérations"
      description="Cadrez une session de délibération, puis validez-la pour figer les résultats de matière et les moyennes."
      singulier="délibération"
      peutEcrire={peutEcrire(user, 'resultats')}
      columns={[
        {
          key: 'president_jury',
          header: 'Délibération',
          primary: true,
          render: (deliberation) => (
            <span className="font-semibold">{deliberation.president_jury}</span>
          ),
        },
        {
          key: 'classe',
          header: 'Classe',
          render: (deliberation) =>
            classes.data?.find((classe) => classe.id === deliberation.classe)?.libelle_auto ??
            `Classe #${deliberation.classe}`,
        },
        {
          key: 'date',
          header: 'Date',
          hideBelow: 'md',
          render: (deliberation) => dateCourte(deliberation.date),
        },
        {
          key: 'statut',
          header: 'Statut',
          render: (deliberation) => (
            <Badge tone={deliberation.statut === 'VALIDEE' ? 'success' : 'warning'}>
              {deliberation.statut === 'VALIDEE' ? 'Validée' : 'Brouillon'}
            </Badge>
          ),
        },
      ]}
      champs={champs}
      filtres={[
        { name: 'classe', label: 'Classe', options: versOptions(classes.data, optionClasse) },
        {
          name: 'statut',
          label: 'Statut',
          options: [
            { value: 'BROUILLON', label: 'Brouillon' },
            { value: 'VALIDEE', label: 'Validée' },
          ],
        },
      ]}
      rowActions={(deliberation) =>
        deliberation.statut === 'BROUILLON' && peutEcrire(user, 'deliberation') ? (
          <BoutonValider deliberation={deliberation} />
        ) : null
      }
    />
  )
}

function BoutonValider({ deliberation }: { deliberation: Deliberation }) {
  const toast = useToast()
  const [ouvert, setOuvert] = useState(false)
  const validation = useAction(`/api/v1/resultats/deliberations/${deliberation.id}/valider/`, [
    'resultats/deliberations',
  ])

  const valider = async () => {
    try {
      await validation.mutateAsync({})
      toast.succes('Délibération validée', 'Les résultats de matière de la période sont figés.')
      setOuvert(false)
    } catch (error) {
      toast.erreur('Validation impossible', (error as Error).message)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon={<BadgeCheck className="size-4" aria-hidden />}
        onClick={(event) => {
          event.stopPropagation()
          setOuvert(true)
        }}
      >
        Valider
      </Button>
      <ConfirmDialog
        open={ouvert}
        onClose={() => setOuvert(false)}
        onConfirm={() => void valider()}
        title="Valider cette délibération ?"
        message="Les résultats de matière de la période seront recalculés et figés. Cette opération est réservée à la direction."
        confirmLabel="Valider la délibération"
        loading={validation.isPending}
      />
    </>
  )
}
