import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Landmark,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, tonStatut } from '@/components/ui/Badge'
import { Card, CardHeader, StatCard } from '@/components/ui/Card'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { dateCourte, fcfa } from '@/lib/format'
import { api } from '@/lib/http'
import { useAuth } from '@/auth/AuthProvider'
import { peutLireFinances } from '@/auth/permissions'
import type {
  EcartCaisse,
  EncaissementRecent,
  DepenseRecente,
  FluxTresorerie,
  PrevisionnelTresorerie,
  SoldeParCompte,
} from '@/lib/types'

export function TresorerieDashboardPage() {
  const { user } = useAuth()
  const autorise = peutLireFinances(user)

  const soldes = useQuery<SoldeParCompte[]>({
    queryKey: ['tresorerie', 'solde-par-compte'],
    queryFn: () => api.get<SoldeParCompte[]>('/api/v1/tresorerie/tableau-de-bord/solde-par-compte/'),
    enabled: autorise,
  })
  const flux = useQuery<FluxTresorerie>({
    queryKey: ['tresorerie', 'flux'],
    queryFn: () => api.get<FluxTresorerie>('/api/v1/tresorerie/tableau-de-bord/flux/', {
      params: { jours: 30 },
    }),
    enabled: autorise,
  })
  const prevision = useQuery<PrevisionnelTresorerie>({
    queryKey: ['tresorerie', 'previsionnel'],
    queryFn: () =>
      api.get<PrevisionnelTresorerie>('/api/v1/tresorerie/tableau-de-bord/previsionnel/', {
        params: { jours: 30 },
      }),
    enabled: autorise,
  })
  const recents = useQuery<EncaissementRecent[]>({
    queryKey: ['tresorerie', 'encaissements-recents'],
    queryFn: () =>
      api.get<EncaissementRecent[]>('/api/v1/tresorerie/tableau-de-bord/encaissements-recents/', {
        params: { limit: 5 },
      }),
    enabled: autorise,
  })
  const depenses = useQuery<DepenseRecente[]>({
    queryKey: ['tresorerie', 'depenses-recentes'],
    queryFn: () =>
      api.get<DepenseRecente[]>('/api/v1/tresorerie/tableau-de-bord/depenses-recentes/', {
        params: { limit: 5 },
      }),
    enabled: autorise,
  })
  const ecarts = useQuery<EcartCaisse[]>({
    queryKey: ['tresorerie', 'ecarts'],
    queryFn: () =>
      api.get<EcartCaisse[]>('/api/v1/tresorerie/tableau-de-bord/ecarts-caisse/', {
        params: { limite_montant: 1000 },
      }),
    enabled: autorise,
  })

  if (!autorise) {
    return (
      <ErrorState
        title="Accès restreint"
        message="La trésorerie est réservée aux rôles comptables, DAF, direction et lecture seule."
      />
    )
  }

  const totalSoldes = (soldes.data ?? []).reduce((sum, compte) => sum + Number(compte.solde), 0)

  return (
    <>
      <PageHeader
        title="Trésorerie"
        description="Vue d’ensemble des soldes, flux et prévisionnel à 30 jours."
        actions={
          <Link
            to="/encaissements"
            className="control-h inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Banknote className="size-4" aria-hidden />
            Nouvel encaissement
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Solde global"
          value={fcfa(totalSoldes)}
          detail={`${soldes.data?.length ?? 0} compte(s) actif(s)`}
          icon={<Wallet className="size-5" aria-hidden />}
        />
        <StatCard
          label="Entrées 30 j"
          value={fcfa(flux.data?.entrants ?? 0)}
          tone="success"
          icon={<ArrowDownLeft className="size-5" aria-hidden />}
        />
        <StatCard
          label="Sorties 30 j"
          value={fcfa(flux.data?.sortants ?? 0)}
          tone="danger"
          icon={<ArrowUpRight className="size-5" aria-hidden />}
        />
        <StatCard
          label="Flux net 30 j"
          value={fcfa(flux.data?.net ?? 0)}
          tone={(flux.data?.net ?? 0) >= 0 ? 'success' : 'danger'}
          icon={<TrendingUp className="size-5" aria-hidden />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Soldes par compte"
            description="Solde initial + crédits validés − débits validés."
            actions={
              <Link to="/comptes" className="text-sm font-semibold text-brand-700 hover:underline">
                Gérer
              </Link>
            }
          />
          {soldes.isLoading ? (
            <LoadingState />
          ) : soldes.error ? (
            <ErrorState message={soldes.error.message} onRetry={() => void soldes.refetch()} />
          ) : (soldes.data ?? []).length === 0 ? (
            <EmptyState title="Aucun compte actif" description="Créez un compte de caisse ou de banque." />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {(soldes.data ?? []).map((compte) => (
                <li key={compte.compte_code} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-[var(--brand-primary-subtle)] text-brand-700">
                    <Landmark className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{compte.compte_libelle}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{compte.compte_code}</p>
                  </div>
                  <span className="numeric text-sm font-semibold">{fcfa(compte.solde)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Prévisionnel à 30 jours"
            description={prevision.data?.methode ? 'Moyenne quotidienne historique sur 30 jours.' : undefined}
          />
          {prevision.isLoading ? (
            <LoadingState />
          ) : (
            <dl className="grid grid-cols-2 gap-4 p-4">
              <div>
                <dt className="text-xs font-semibold text-[var(--muted-foreground)] uppercase">Solde actuel</dt>
                <dd className="numeric mt-1 text-lg font-bold">{fcfa(prevision.data?.solde_actuel ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[var(--muted-foreground)] uppercase">Solde prévu</dt>
                <dd className="numeric mt-1 text-lg font-bold text-brand-700">
                  {fcfa(prevision.data?.solde_prevue_fin ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[var(--muted-foreground)] uppercase">Entrées prévues</dt>
                <dd className="numeric mt-1">{fcfa(prevision.data?.prevision_entrees ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[var(--muted-foreground)] uppercase">Sorties prévues</dt>
                <dd className="numeric mt-1">{fcfa(prevision.data?.prevision_sorties ?? 0)}</dd>
              </div>
            </dl>
          )}
        </Card>

        <Card>
          <CardHeader title="Encaissements récents" actions={<Link to="/encaissements" className="text-sm font-semibold text-brand-700 hover:underline">Tout voir</Link>} />
          {recents.isLoading ? (
            <LoadingState />
          ) : (recents.data ?? []).length === 0 ? (
            <EmptyState title="Aucun encaissement" />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {(recents.data ?? []).map((encaissement) => (
                <li key={encaissement.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{encaissement.etudiant_nom}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {encaissement.recu_numero} · {dateCourte(encaissement.date)} · {encaissement.mode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="numeric text-sm font-semibold">{fcfa(encaissement.montant_total)}</p>
                    <Badge tone={tonStatut(encaissement.statut)}>{encaissement.statut}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Dépenses récentes" actions={<Link to="/depenses" className="text-sm font-semibold text-brand-700 hover:underline">Tout voir</Link>} />
          {depenses.isLoading ? (
            <LoadingState />
          ) : (depenses.data ?? []).length === 0 ? (
            <EmptyState title="Aucune dépense" />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {(depenses.data ?? []).map((depense) => (
                <li key={depense.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{depense.designation}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {depense.beneficiaire} · {dateCourte(depense.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="numeric text-sm font-semibold">{fcfa(depense.montant)}</p>
                    <Badge tone={tonStatut(depense.statut)}>{depense.statut}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {(ecarts.data ?? []).length > 0 ? (
        <Card className="mt-4 border-[var(--warning)]/40">
          <CardHeader
            title="Écarts de caisse à surveiller"
            description="Arrêtés validés dont l’écart dépasse 1 000 FCFA."
            actions={<AlertTriangle className="size-5 text-[var(--warning)]" aria-hidden />}
          />
          <ul className="divide-y divide-[var(--border)]">
            {(ecarts.data ?? []).map((ecart) => (
              <li key={ecart.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {ecart.compte_libelle} — {dateCourte(ecart.date)}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Théorique {fcfa(ecart.solde_theorique)} · Physique {fcfa(ecart.solde_physique)}
                  </p>
                </div>
                <Badge tone={Number(ecart.ecart) === 0 ? 'success' : 'warning'}>
                  Écart {fcfa(ecart.ecart)}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  )
}
