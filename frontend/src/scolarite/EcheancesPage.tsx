import { CalendarClock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { DataTable, Pagination, type Column } from '@/components/data/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '@/components/data/Toolbar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/Card'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { dateCourte, fcfa } from '@/lib/format'
import { api } from '@/lib/http'
import type { EcheancierLigne } from '@/lib/types'

const PAR_PAGE = 25

type Etat = 'retard' | 'encours' | 'paye'

function etatDe(ligne: EcheancierLigne): Etat {
  if (ligne.reste <= 0) return 'paye'
  return ligne.en_retard ? 'retard' : 'encours'
}

/**
 * L'échéancier est servi par `rapports/echeancier/`, seul endpoint qui expose
 * le reste dû et le retard calculés côté serveur (le CRUD `echeances` ne filtre
 * que par inscription ou numéro).
 */
export function EcheancesPage() {
  const { data, isLoading, error, refetch } = useQuery<EcheancierLigne[]>({
    queryKey: ['rapport', 'echeancier'],
    queryFn: () => api.get<EcheancierLigne[]>('/api/v1/rapports/echeancier/'),
  })

  const [page, setPage] = useState(1)
  const [etat, setEtat] = useState<string>('retard')
  const [recherche, setRecherche] = useState('')

  const lignes = useMemo(() => {
    const terme = recherche.trim()
    return (data ?? []).filter((ligne) => {
      if (etat && etatDe(ligne) !== etat) return false
      if (terme && !String(ligne.inscription_id).includes(terme)) return false
      return true
    })
  }, [data, etat, recherche])

  const total = lignes.length
  const pageCount = Math.max(1, Math.ceil(total / PAR_PAGE))
  const pageCourante = Math.min(page, pageCount)
  const visibles = lignes.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE)

  const enRetard = (data ?? []).filter((ligne) => etatDe(ligne) === 'retard')
  const resteTotal = enRetard.reduce((sum, ligne) => sum + Math.max(0, ligne.reste), 0)

  const colonnes: Column<EcheancierLigne>[] = [
    {
      key: 'inscription',
      header: 'Inscription',
      primary: true,
      render: (ligne) => (
        <Link
          to={`/inscriptions/${ligne.inscription_id}`}
          className="font-semibold text-brand-700 hover:underline"
        >
          Inscription #{ligne.inscription_id}
        </Link>
      ),
    },
    {
      key: 'numero',
      header: 'Échéance',
      render: (ligne) =>
        ligne.numero === 0 ? 'Frais d’inscription' : `Mensualité ${ligne.numero}`,
    },
    {
      key: 'date_prevue',
      header: 'Échéance du',
      hideBelow: 'md',
      render: (ligne) => dateCourte(ligne.date_prevue),
    },
    {
      key: 'montant_prevu',
      header: 'Montant prévu',
      align: 'right',
      render: (ligne) => <span className="numeric">{fcfa(ligne.montant_prevu)}</span>,
    },
    {
      key: 'montant_regle',
      header: 'Réglé',
      align: 'right',
      hideBelow: 'sm',
      render: (ligne) => <span className="numeric">{fcfa(ligne.montant_regle)}</span>,
    },
    {
      key: 'reste',
      header: 'Reste',
      align: 'right',
      render: (ligne) => (
        <span
          className={`numeric font-semibold ${
            ligne.reste > 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'
          }`}
        >
          {fcfa(Math.max(0, ligne.reste))}
        </span>
      ),
    },
    {
      key: 'etat',
      header: 'État',
      render: (ligne) => {
        const valeur = etatDe(ligne)
        return (
          <Badge
            tone={valeur === 'paye' ? 'success' : valeur === 'retard' ? 'danger' : 'warning'}
          >
            {valeur === 'paye' ? 'Soldée' : valeur === 'retard' ? 'En retard' : 'En cours'}
          </Badge>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Échéancier"
        description="Suivi des échéances de scolarité, calculé par le serveur à partir des imputations d’encaissement."
        badge={<Badge tone="neutral">Lecture seule</Badge>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Échéances en retard"
          value={enRetard.length}
          tone="danger"
          icon={<CalendarClock className="size-5" aria-hidden />}
        />
        <StatCard label="Reste à recouvrer (retard)" value={fcfa(resteTotal)} tone="warning" />
        <StatCard label="Échéances suivies" value={data?.length ?? 0} />
      </div>

      <FilterBar
        search={
          <SearchInput
            value={recherche}
            onChange={(value) => {
              setRecherche(value)
              setPage(1)
            }}
            placeholder="Numéro d’inscription…"
          />
        }
        actifs={etat ? 1 : 0}
        onReset={() => {
          setEtat('')
          setRecherche('')
          setPage(1)
        }}
      >
        <SelectFilter
          label="État"
          value={etat}
          allLabel="Toutes"
          options={[
            { value: 'retard', label: 'En retard' },
            { value: 'encours', label: 'En cours' },
            { value: 'paye', label: 'Soldées' },
          ]}
          onChange={(value) => {
            setEtat(value)
            setPage(1)
          }}
        />
      </FilterBar>

      {error ? (
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingState />
      ) : (
        <DataTable
          columns={colonnes}
          rows={visibles}
          rowKey={(ligne) => ligne.echeance_id}
          caption="Échéances de scolarité"
          emptyTitle="Aucune échéance"
          emptyDescription="Aucune échéance ne correspond au filtre sélectionné."
          footer={
            <Pagination page={pageCourante} pageCount={pageCount} total={total} onChange={setPage} />
          }
        />
      )}
    </>
  )
}
