import { useState } from 'react'

import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { dateCourte } from '@/lib/format'
import type { Periode, SessionExamen } from '@/lib/types'
import {
  optionAnnee,
  optionPeriode,
  R,
  useAnnees,
  usePeriodes,
  versOptions,
} from './hooks'

type Onglet = 'periodes' | 'sessions'

export function PeriodesPage() {
  const { user } = useAuth()
  const [onglet, setOnglet] = useState<Onglet>('periodes')
  const annees = useAnnees()

  return (
    <>
      <PageHeader
        title="Périodes & sessions"
        description="Les périodes structurent les résultats (semestres). Chaque période porte une session normale et, si besoin, une session de rattrapage."
      />
      <div className="mb-3">
        <Tabs<Onglet>
          label="Type de référentiel"
          value={onglet}
          onChange={setOnglet}
          tabs={[
            { value: 'periodes', label: 'Périodes' },
            { value: 'sessions', label: 'Sessions d’examen' },
          ]}
        />
      </div>

      {onglet === 'periodes' ? (
        <PeriodeTable peutEcrire={peutEcrire(user, 'referentielPedagogique')} annees={annees.data} />
      ) : (
        <SessionTable peutEcrire={peutEcrire(user, 'referentielPedagogique')} />
      )}
    </>
  )
}

function PeriodeTable({
  peutEcrire: ecriture,
  annees,
}: {
  peutEcrire: boolean
  annees: ReturnType<typeof useAnnees>['data']
}) {
  const champs: FormulaireChamp[] = [
    {
      name: 'annee_scolaire',
      label: 'Année scolaire',
      type: 'select',
      required: true,
      options: versOptions(annees, optionAnnee),
    },
    { name: 'numero', label: 'Numéro', type: 'number', required: true, min: 1, max: 2 },
    { name: 'libelle', label: 'Libellé', required: true, colSpan: 2, placeholder: 'Semestre 1' },
    { name: 'date_debut', label: 'Début', type: 'date', required: true },
    { name: 'date_fin', label: 'Fin', type: 'date', required: true },
  ]

  return (
    <ResourcePage<Periode>
      resource={R.periodes}
      titre="Périodes"
      sansEntete
      description="Les périodes (semestres) d’une année scolaire."
      singulier="période"
      peutEcrire={ecriture}
      columns={[
        {
          key: 'libelle',
          header: 'Période',
          primary: true,
          sortable: true,
          render: (periode) => <span className="font-semibold">{periode.libelle}</span>,
        },
        {
          key: 'annee_scolaire',
          header: 'Année',
          render: (periode) => (
            <Badge tone="brand">{periode.annee_scolaire_libelle}</Badge>
          ),
        },
        {
          key: 'date_debut',
          header: 'Début',
          hideBelow: 'sm',
          render: (periode) => dateCourte(periode.date_debut),
        },
        { key: 'date_fin', header: 'Fin', render: (periode) => dateCourte(periode.date_fin) },
      ]}
      champs={champs}
      filtres={[{ name: 'annee_scolaire', label: 'Année', options: versOptions(annees, optionAnnee) }]}
    />
  )
}

function SessionTable({ peutEcrire: ecriture }: { peutEcrire: boolean }) {
  const periodes = usePeriodes()
  const champs: FormulaireChamp[] = [
    {
      name: 'periode',
      label: 'Période',
      type: 'select',
      required: true,
      options: versOptions(periodes.data, optionPeriode),
      colSpan: 2,
    },
    {
      name: 'type',
      label: 'Type de session',
      type: 'select',
      required: true,
      options: [
        { value: 'NORMALE', label: 'Normale' },
        { value: 'RATTRAPAGE', label: 'Rattrapage' },
      ],
    },
    { name: 'date_debut', label: 'Début' },
    { name: 'date_fin', label: 'Fin' },
  ]

  return (
    <ResourcePage<SessionExamen>
      resource={R.sessions}
      titre="Sessions d’examen"
      sansEntete
      description="Chaque période dispose d’une session normale ; le rattrapage est optionnel."
      singulier="session"
      peutEcrire={ecriture}
      columns={[
        {
          key: 'type',
          header: 'Session',
          primary: true,
          render: (session) => (
            <Badge tone={session.type === 'NORMALE' ? 'brand' : 'accent'}>
              {session.type === 'NORMALE' ? 'Normale' : 'Rattrapage'}
            </Badge>
          ),
        },
        {
          key: 'periode',
          header: 'Période',
          render: (session) => session.periode_libelle,
        },
        {
          key: 'dates',
          header: 'Dates',
          render: (session) =>
            session.date_debut || session.date_fin
              ? `${dateCourte(session.date_debut)} → ${dateCourte(session.date_fin)}`
              : 'Non planifiée',
        },
      ]}
      champs={champs}
      filtres={[{ name: 'periode', label: 'Période', options: versOptions(periodes.data, optionPeriode) }]}
    />
  )
}
