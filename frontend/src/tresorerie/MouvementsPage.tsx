import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'

import { DataTable, Pagination, type Column } from '@/components/data/DataTable'
import { FilterBar, SelectFilter } from '@/components/data/Toolbar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card, StatCard } from '@/components/ui/Card'
import { dateCourte, fcfa } from '@/lib/format'
import { usePagedList } from '@/lib/hooks'
import type { Mouvement } from '@/lib/types'
import { T, useComptes } from './hooks'

export function MouvementsPage() {
  const comptes = useComptes()
  const [page, setPage] = useState(1)
  const [compte, setCompte] = useState('')
  const [sens, setSens] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filtresOuverts, setFiltresOuverts] = useState(false)

  const query = usePagedList<Mouvement>(T.mouvements, {
    page,
    ...(compte ? { compte } : {}),
    ...(sens ? { sens } : {}),
    ...(dateDebut ? { date_debut: dateDebut } : {}),
    ...(dateFin ? { date_fin: dateFin } : {}),
  })

  const rows = query.data?.results ?? []
  const total = query.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 25))
  const credits = rows.filter((mouvement) => mouvement.sens === 'CREDIT').reduce((s, m) => s + Number(m.montant), 0)
  const debits = rows.filter((mouvement) => mouvement.sens === 'DEBIT').reduce((s, m) => s + Number(m.montant), 0)

  const colonnes: Column<Mouvement>[] = [
    {
      key: 'libelle',
      header: 'Mouvement',
      primary: true,
      render: (mouvement) => (
        <span className="flex items-center gap-2">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-lg ${
              mouvement.sens === 'CREDIT'
                ? 'bg-[var(--success-subtle)] text-[var(--success)]'
                : 'bg-[var(--destructive-subtle)] text-[var(--destructive)]'
            }`}
          >
            {mouvement.sens === 'CREDIT' ? (
              <ArrowDownLeft className="size-4" aria-hidden />
            ) : (
              <ArrowUpRight className="size-4" aria-hidden />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{mouvement.libelle}</span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {mouvement.categorie_mouvement_libelle}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'date_operation',
      header: 'Date',
      hideBelow: 'md',
      render: (mouvement) => dateCourte(mouvement.date_operation),
    },
    {
      key: 'compte',
      header: 'Compte',
      hideBelow: 'lg',
      render: (mouvement) => mouvement.compte_code,
    },
    {
      key: 'ecole',
      header: 'École',
      hideBelow: 'xl',
      render: (mouvement) => mouvement.ecole_nom ?? '—',
    },
    {
      key: 'montant',
      header: 'Montant',
      align: 'right',
      render: (mouvement) => (
        <span
          className={`numeric font-semibold ${
            mouvement.sens === 'CREDIT' ? 'text-[var(--success)]' : 'text-[var(--destructive)]'
          }`}
        >
          {mouvement.sens === 'CREDIT' ? '+' : '−'}
          {fcfa(mouvement.montant)}
        </span>
      ),
    },
    {
      key: 'piece_reference',
      header: 'Pièce',
      hideBelow: 'xl',
      render: (mouvement) => (
        <span className="font-mono text-xs">{mouvement.piece_reference ?? '—'}</span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Journal de trésorerie"
        description="Tous les mouvements de débit et de crédit, avec leur pièce justificative. Un mouvement validé impacte le solde du compte."
        badge={<Badge tone="neutral">Lecture seule</Badge>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Mouvements (page)" value={rows.length} />
        <StatCard label="Crédits (page)" value={fcfa(credits)} tone="success" />
        <StatCard label="Débits (page)" value={fcfa(debits)} tone="danger" />
      </div>

      <FilterBar
        actifs={[compte, sens, dateDebut, dateFin].filter(Boolean).length}
        mobileOpen={filtresOuverts}
        onToggleMobile={() => setFiltresOuverts((open) => !open)}
        onReset={() => {
          setCompte('')
          setSens('')
          setDateDebut('')
          setDateFin('')
          setPage(1)
        }}
      >
        <SelectFilter
          label="Compte"
          value={compte}
          allLabel="Tous"
          options={(comptes.data ?? []).map((item) => ({ value: item.id, label: item.code }))}
          onChange={(value) => {
            setCompte(value)
            setPage(1)
          }}
        />
        <SelectFilter
          label="Sens"
          value={sens}
          allLabel="Tous"
          options={[
            { value: 'CREDIT', label: 'Crédit' },
            { value: 'DEBIT', label: 'Débit' },
          ]}
          onChange={(value) => {
            setSens(value)
            setPage(1)
          }}
        />
        <label className="block min-w-0 flex-1 sm:w-40 sm:flex-none">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Du</span>
          <input type="date" value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} className="control h-10 min-h-10 py-1 text-sm" />
        </label>
        <label className="block min-w-0 flex-1 sm:w-40 sm:flex-none">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Au</span>
          <input type="date" value={dateFin} onChange={(event) => setDateFin(event.target.value)} className="control h-10 min-h-10 py-1 text-sm" />
        </label>
      </FilterBar>

      <Card className="overflow-hidden">
        <DataTable
          columns={colonnes}
          rows={rows}
          rowKey={(mouvement) => mouvement.id}
          caption="Journal des mouvements"
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.refetch()}
          emptyTitle="Aucun mouvement"
          emptyDescription="Les mouvements sont créés par les encaissements, dépenses, virements et arrêtés."
          footer={<Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />}
        />
      </Card>
    </>
  )
}
