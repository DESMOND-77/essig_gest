import { FileDown } from 'lucide-react'
import { useState } from 'react'

import { DataTable, Pagination, type Column } from '@/components/data/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '@/components/data/Toolbar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, tonStatut } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { decimal, nombre } from '@/lib/format'
import { useDebounced, usePagedList } from '@/lib/hooks'
import { openDocument } from '@/lib/http'
import type { ResultatAnnuel, ResultatMatiere, ResultatPeriode } from '@/lib/types'
import {
  optionAnnee,
  optionPeriode,
  useAnnees,
  usePeriodes,
  versOptions,
} from '@/referentiel/hooks'

type Onglet = 'annuels' | 'periodes' | 'matieres'

const DECISIONS = [
  { value: 'ADMIS', label: 'Admis' },
  { value: 'ADMIS_CONDITIONNEL', label: 'Admis conditionnel' },
  { value: 'REDOUBLE', label: 'Redouble' },
  { value: 'AJOURNE', label: 'Ajourné' },
  { value: 'EXCLU', label: 'Exclu' },
]

const LIBELLE_DECISION: Record<string, string> = {
  ADMIS: 'Admis',
  ADMIS_CONDITIONNEL: 'Admis conditionnel',
  REDOUBLE: 'Redouble',
  AJOURNE: 'Ajourné',
  EXCLU: 'Exclu',
}

const LIBELLE_MENTION: Record<string, string> = {
  PASSABLE: 'Passable',
  AB: 'Assez bien',
  B: 'Bien',
  TB: 'Très bien',
}

export function ResultatsPage() {
  const { user } = useAuth()
  const [onglet, setOnglet] = useState<Onglet>('annuels')
  const annees = useAnnees()
  const periodes = usePeriodes()
  const [annee, setAnnee] = useState('')
  const [decision, setDecision] = useState('')
  const [periode, setPeriode] = useState('')
  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const rechercheDebounced = useDebounced(recherche, 350)
  const toast = useToast()

  const params = {
    page,
    ...(rechercheDebounced ? { search: rechercheDebounced } : {}),
    ...(annee ? { annee_scolaire: annee } : {}),
    ...(periode ? { periode } : {}),
    ...(decision ? { decision } : {}),
  }

  const annuels = usePagedList<ResultatAnnuel>('resultats/resultats-annuels', params, {
    enabled: onglet === 'annuels',
  })
  const parPeriodes = usePagedList<ResultatPeriode>('resultats/resultats-periodes', params, {
    enabled: onglet === 'periodes',
  })
  const parMatieres = usePagedList<ResultatMatiere>('resultats/resultats-matiere', params, {
    enabled: onglet === 'matieres',
  })

  const query = onglet === 'annuels' ? annuels : onglet === 'periodes' ? parPeriodes : parMatieres
  const rows = query.data?.results ?? []
  const total = query.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 25))

  const colonnesAnnuels: Column<ResultatAnnuel>[] = [
    {
      key: 'inscription',
      header: 'Inscription',
      primary: true,
      render: (resultat) => <span className="font-semibold">Inscription #{resultat.inscription}</span>,
    },
    {
      key: 'moyenne',
      header: 'Moyenne',
      align: 'right',
      render: (resultat) => (
        <span className="numeric font-semibold">{decimal(resultat.moyenne_annuelle)}</span>
      ),
    },
    {
      key: 'credits',
      header: 'Crédits',
      align: 'right',
      hideBelow: 'md',
      render: (resultat) =>
        `${nombre(resultat.credits_acquis ?? 0)} / ${nombre(resultat.credits_requis ?? 0)}`,
    },
    {
      key: 'dette',
      header: 'Dette',
      align: 'right',
      hideBelow: 'lg',
      render: (resultat) => (resultat.dette_credits ? nombre(resultat.dette_credits) : '—'),
    },
    {
      key: 'decision',
      header: 'Décision',
      render: (resultat) => (
        <Badge tone={tonStatut(resultat.decision)}>
          {LIBELLE_DECISION[resultat.decision] ?? resultat.decision}
        </Badge>
      ),
    },
    {
      key: 'mention',
      header: 'Mention',
      hideBelow: 'sm',
      render: (resultat) => (resultat.mention ? LIBELLE_MENTION[resultat.mention] : '—'),
    },
    {
      key: 'bulletin',
      header: '',
      align: 'right',
      render: (resultat) => (
        <button
          type="button"
          onClick={async () => {
            try {
              await openDocument(`/api/v1/resultats/resultats-annuels/${resultat.id}/bulletin/`)
            } catch (error) {
              toast.erreur('Bulletin indisponible', (error as Error).message)
            }
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-[var(--brand-primary-subtle)]"
        >
          <FileDown className="size-4" aria-hidden />
          Bulletin
        </button>
      ),
    },
  ]

  const colonnesPeriodes: Column<ResultatPeriode>[] = [
    {
      key: 'inscription',
      header: 'Inscription',
      primary: true,
      render: (resultat) => <span className="font-semibold">Inscription #{resultat.inscription}</span>,
    },
    {
      key: 'periode',
      header: 'Période',
      render: (resultat) =>
        periodes.data?.find((p) => p.id === resultat.periode)?.libelle ?? `Période #${resultat.periode}`,
    },
    {
      key: 'moyenne',
      header: 'Moyenne pondérée',
      align: 'right',
      render: (resultat) => (
        <span className="numeric font-semibold">{decimal(resultat.moyenne_ponderee)}</span>
      ),
    },
    {
      key: 'credits',
      header: 'Crédits acquis',
      align: 'right',
      hideBelow: 'sm',
      render: (resultat) => nombre(resultat.credits_acquis ?? 0),
    },
    {
      key: 'rang',
      header: 'Rang',
      align: 'right',
      hideBelow: 'md',
      render: (resultat) => (resultat.rang ? `#${resultat.rang}` : '—'),
    },
  ]

  const colonnesMatieres: Column<ResultatMatiere>[] = [
    {
      key: 'inscription',
      header: 'Inscription',
      primary: true,
      render: (resultat) => <span className="font-semibold">Inscription #{resultat.inscription}</span>,
    },
    {
      key: 'matiere',
      header: 'Matière',
      render: (resultat) => `Matière #${resultat.matiere}`,
    },
    {
      key: 'note_normale',
      header: 'Note normale',
      align: 'right',
      hideBelow: 'md',
      render: (resultat) => decimal(resultat.note_normale),
    },
    {
      key: 'note_rattrapage',
      header: 'Rattrapage',
      align: 'right',
      hideBelow: 'lg',
      render: (resultat) => decimal(resultat.note_rattrapage),
    },
    {
      key: 'note_retenue',
      header: 'Note retenue',
      align: 'right',
      render: (resultat) => (
        <span className="numeric font-semibold">{decimal(resultat.note_retenue)}</span>
      ),
    },
    {
      key: 'validee',
      header: 'Validée',
      render: (resultat) => (
        <Badge tone={resultat.validee ? 'success' : 'warning'}>
          {resultat.validee ? 'Oui' : 'Non'}
        </Badge>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Résultats"
        description="Résultats annuels, moyennes de période et notes de matière. Les bulletins sont générés en PDF par le serveur."
        badge={peutEcrire(user, 'resultats') ? undefined : <Badge tone="neutral">Lecture seule</Badge>}
      />

      <div className="mb-3">
        <Tabs<Onglet>
          label="Type de résultats"
          value={onglet}
          onChange={(value) => {
            setOnglet(value)
            setPage(1)
          }}
          tabs={[
            { value: 'annuels', label: 'Résultats annuels', count: annuels.data?.count },
            { value: 'periodes', label: 'Par période', count: parPeriodes.data?.count },
            { value: 'matieres', label: 'Par matière', count: parMatieres.data?.count },
          ]}
        />
      </div>

      <FilterBar
        search={
          <SearchInput
            value={recherche}
            onChange={(value) => {
              setRecherche(value)
              setPage(1)
            }}
            placeholder="Rechercher un étudiant (nom, matricule)…"
          />
        }
        actifs={[annee, decision, periode].filter(Boolean).length}
        onReset={() => {
          setAnnee('')
          setDecision('')
          setPeriode('')
          setPage(1)
        }}
      >
        <SelectFilter
          label="Année"
          value={annee}
          allLabel="Toutes"
          options={versOptions(annees.data, optionAnnee)}
          onChange={(value) => {
            setAnnee(value)
            setPage(1)
          }}
        />
        <SelectFilter
          label="Période"
          value={periode}
          allLabel="Toutes"
          options={versOptions(periodes.data, optionPeriode)}
          onChange={(value) => {
            setPeriode(value)
            setPage(1)
          }}
        />
        {onglet === 'annuels' ? (
          <SelectFilter
            label="Décision"
            value={decision}
            allLabel="Toutes"
            options={DECISIONS}
            onChange={(value) => {
              setDecision(value)
              setPage(1)
            }}
          />
        ) : null}
      </FilterBar>

      {onglet === 'annuels' ? (
        <DataTable
          columns={colonnesAnnuels}
          rows={rows as ResultatAnnuel[]}
          rowKey={(resultat) => resultat.id}
          caption="Résultats annuels"
          loading={annuels.isLoading}
          error={annuels.error}
          onRetry={() => void annuels.refetch()}
          emptyTitle="Aucun résultat annuel"
          emptyDescription="Les résultats annuels sont produits lors de la validation des délibérations."
          footer={<Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />}
        />
      ) : onglet === 'periodes' ? (
        <DataTable
          columns={colonnesPeriodes}
          rows={rows as ResultatPeriode[]}
          rowKey={(resultat) => resultat.id}
          caption="Résultats par période"
          loading={parPeriodes.isLoading}
          error={parPeriodes.error}
          onRetry={() => void parPeriodes.refetch()}
          emptyTitle="Aucun résultat de période"
          emptyDescription="Validez une délibération pour calculer les moyennes de période."
          footer={<Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />}
        />
      ) : (
        <DataTable
          columns={colonnesMatieres}
          rows={rows as ResultatMatiere[]}
          rowKey={(resultat) => resultat.id}
          caption="Résultats par matière"
          loading={parMatieres.isLoading}
          error={parMatieres.error}
          onRetry={() => void parMatieres.refetch()}
          emptyTitle="Aucun résultat de matière"
          emptyDescription="Les résultats de matière sont figés à la validation d’une délibération."
          footer={<Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />}
        />
      )}
    </>
  )
}
