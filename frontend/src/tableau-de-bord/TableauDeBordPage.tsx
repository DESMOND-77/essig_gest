import {
  AlertTriangle,
  Banknote,
  Coins,
  GraduationCap,
  PiggyBank,
  TrendingDown,
  Users,
  Wallet,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, StatCard } from '@/components/ui/Card'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { fcfa } from '@/lib/format'
import { api } from '@/lib/http'
import { useAuth } from '@/auth/AuthProvider'
import { peutLireFinances } from '@/auth/permissions'
import type { TableauDeBord } from '@/lib/types'

const LIBELLE_DECISION: Record<string, string> = {
  ADMIS: 'Admis',
  ADMIS_CONDITIONNEL: 'Admis conditionnel',
  REDOUBLE: 'Redouble',
  AJOURNE: 'Ajourné',
  EXCLU: 'Exclu',
}

const TONS_DECISION: Record<string, 'success' | 'brand' | 'warning' | 'danger' | 'neutral'> = {
  ADMIS: 'success',
  ADMIS_CONDITIONNEL: 'brand',
  REDOUBLE: 'warning',
  AJOURNE: 'warning',
  EXCLU: 'danger',
}

export function TableauDeBordPage() {
  const { user } = useAuth()
  const finances = peutLireFinances(user)

  const { data, isLoading, error, refetch } = useQuery<TableauDeBord>({
    queryKey: ['tableau-de-bord'],
    queryFn: () => api.get<TableauDeBord>('/api/v1/rapports/tableau-de-bord/'),
    staleTime: 60_000,
  })

  if (isLoading) return <LoadingState label="Chargement du tableau de bord…" />
  if (error || !data) {
    return (
      <ErrorState
        title="Tableau de bord indisponible"
        message={error?.message}
        onRetry={() => void refetch()}
      />
    )
  }

  const decisions = Object.entries(data.resultats_par_decision ?? {}).sort((a, b) => b[1] - a[1])
  const totalDecisions = decisions.reduce((sum, [, valeur]) => sum + valeur, 0)
  const tauxRecouvrement =
    data.reste_a_recouvrer + data.encaissements > 0
      ? (data.encaissements / (data.encaissements + data.reste_a_recouvrer)) * 100
      : 0

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={
          data.annee_scolaire_libelle
            ? `Indicateurs de l’année scolaire ${data.annee_scolaire_libelle}.`
            : 'Indicateurs consolidés de l’établissement.'
        }
        badge={<Badge tone="brand">{data.annee_scolaire_libelle ?? 'Toutes années'}</Badge>}
        actions={
          <Link
            to="/rapports"
            className="control-h inline-flex items-center rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--surface-muted)]"
          >
            Rapports détaillés
          </Link>
        }
      />

      <section aria-labelledby="synthese" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <h2 id="synthese" className="sr-only">
          Synthèse de l’année
        </h2>
        <StatCard
          label="Étudiants inscrits"
          value={data.etudiants_inscrits}
          detail="Inscriptions actives"
          icon={<GraduationCap className="size-5" aria-hidden />}
        />
        <StatCard
          label="Encaissements"
          value={fcfa(data.encaissements)}
          detail="Reçus validés"
          tone="success"
          icon={<Banknote className="size-5" aria-hidden />}
        />
        <StatCard
          label="Reste à recouvrer"
          value={fcfa(data.reste_a_recouvrer)}
          detail={`${tauxRecouvrement.toFixed(0)} % déjà encaissé`}
          tone="danger"
          icon={<TrendingDown className="size-5" aria-hidden />}
        />
        <StatCard
          label="Dépenses payées"
          value={fcfa(data.depenses)}
          detail="Sur l’année courante"
          tone="warning"
          icon={<Wallet className="size-5" aria-hidden />}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Situation financière" description="Trésorerie disponible et masse salariale." />
          <dl className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <PiggyBank className="size-4" aria-hidden />
                Solde des comptes
              </dt>
              <dd className="numeric text-base font-bold text-brand-700">{fcfa(data.solde_comptes)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Coins className="size-4" aria-hidden />
                Masse salariale
              </dt>
              <dd className="numeric text-base font-bold">{fcfa(data.masse_salariale)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
              <dt className="text-sm font-semibold">Trésorerie nette estimée</dt>
              <dd className="numeric text-base font-bold">
                {fcfa(data.solde_comptes - data.masse_salariale)}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Résultats par décision"
            description="Délibérations de fin d’année."
            actions={
              <Link to="/resultats" className="text-sm font-semibold text-brand-700 hover:underline">
                Détail
              </Link>
            }
          />
          {decisions.length === 0 ? (
            <p className="p-4 text-sm text-[var(--muted-foreground)]">
              Aucun résultat annuel enregistré pour cette année.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {decisions.map(([decision, nombre]) => (
                <li key={decision} className="flex items-center gap-3 px-4 py-2.5">
                  <Badge tone={TONS_DECISION[decision] ?? 'neutral'}>
                    {LIBELLE_DECISION[decision] ?? decision}
                  </Badge>
                  <span className="ml-auto numeric text-sm font-semibold">{nombre}</span>
                  <span className="w-10 text-right text-xs text-[var(--muted-foreground)]">
                    {totalDecisions > 0 ? `${Math.round((nombre / totalDecisions) * 100)} %` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Alertes" description="Points nécessitant une action." />
          <ul className="divide-y divide-[var(--border)]">
            <li>
              <Link
                to="/echeances"
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-muted)]"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-[var(--warning-subtle)] text-[var(--warning)]">
                  <AlertTriangle className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Échéances en retard</span>
                  <span className="block text-xs text-[var(--muted-foreground)]">
                    Paiements attendus et non soldés
                  </span>
                </span>
                <span className="numeric text-lg font-bold">{data.alertes?.echeances_en_retard ?? 0}</span>
              </Link>
            </li>
            <li>
              <Link
                to="/arretes-caisse"
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-muted)]"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-[var(--destructive-subtle)] text-[var(--destructive)]">
                  <AlertTriangle className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Arrêtés de caisse en écart</span>
                  <span className="block text-xs text-[var(--muted-foreground)]">
                    Solde théorique ≠ solde physique
                  </span>
                </span>
                <span className="numeric text-lg font-bold">{data.alertes?.arretes_caisse_en_ecart ?? 0}</span>
              </Link>
            </li>
            <li>
              <Link
                to="/etudiants"
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-muted)]"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-[var(--brand-primary-subtle)] text-brand-700">
                  <Users className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Inscriptions actives</span>
                  <span className="block text-xs text-[var(--muted-foreground)]">
                    Étudiants inscrits cette année
                  </span>
                </span>
                <span className="numeric text-lg font-bold">{data.etudiants_inscrits}</span>
              </Link>
            </li>
          </ul>
        </Card>
      </div>

      {!finances ? (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          Les montants financiers sont visibles par tous les rôles, mais leur détail est réservé aux
          profils comptables, DAF et direction.
        </p>
      ) : null}
    </>
  )
}
