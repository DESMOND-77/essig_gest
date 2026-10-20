import { BadgeCheck, Calculator, Plus, Scale } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DataTable, Pagination, type Column } from '@/components/data/DataTable'
import { FilterBar, SelectFilter } from '@/components/data/Toolbar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, tonStatut } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { FormGrid, InputField, SelectField } from '@/components/ui/FormField'
import { EmptyState, InfoBanner, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { aujourdhui, dateCourte, fcfa } from '@/lib/format'
import { api } from '@/lib/http'
import { useAction, useAll, useCreate, usePagedList } from '@/lib/hooks'
import type { ArreteCaisse, Billetage } from '@/lib/types'
import { T, useComptes } from './hooks'

const COUPURES = [10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25]

export function ArretesCaissePage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'tresorerie')
  const validation = peutEcrire(user, 'tresorerieValidation')
  const toast = useToast()
  const comptes = useComptes()

  const [page, setPage] = useState(1)
  const [compte, setCompte] = useState('')
  const [statut, setStatut] = useState('')
  const [ouverture, setOuverture] = useState(false)
  const [billetage, setBilletage] = useState<ArreteCaisse | null>(null)
  const [aValider, setAValider] = useState<ArreteCaisse | null>(null)

  const query = usePagedList<ArreteCaisse>(T.arretes, {
    page,
    ...(compte ? { compte } : {}),
    ...(statut ? { statut } : {}),
    ordering: '-date',
  })

  const creation = useCreate<ArreteCaisse>(T.arretes)
  const actionValider = useAction(`/api/v1/${T.arretes}/${aValider?.id ?? 0}/valider/`, [T.arretes])

  const [formulaire, setFormulaire] = useState({
    compte: '',
    date: aujourdhui(),
    solde_physique: '',
  })
  const [soldeTheorique, setSoldeTheorique] = useState<number | null>(null)
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({})

  const rows = query.data?.results ?? []
  const total = query.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 25))

  const ecart = useMemo(
    () => (soldeTheorique === null ? null : Number(formulaire.solde_physique || 0) - soldeTheorique),
    [formulaire.solde_physique, soldeTheorique],
  )

  const calculerTheorique = async () => {
    if (!formulaire.compte || !formulaire.date) {
      toast.erreur('Champs requis', 'Choisissez un compte et une date.')
      return
    }
    try {
      const reponse = await api.get<{ solde_theorique: number }>(
        `/api/v1/${T.arretes}/solde-theorique/`,
        { params: { compte_id: formulaire.compte, date: formulaire.date } },
      )
      setSoldeTheorique(Number(reponse.solde_theorique))
    } catch (error) {
      toast.erreur('Calcul impossible', (error as Error).message)
    }
  }

  const soumettre = async () => {
    const manquants: Record<string, string[]> = {}
    if (!formulaire.compte) manquants.compte = ['Compte requis.']
    if (!formulaire.date) manquants.date = ['Date requise.']
    if (formulaire.solde_physique === '') manquants.solde_physique = ['Solde physique requis.']
    if (Object.keys(manquants).length > 0) {
      setErreurs(manquants)
      return
    }
    try {
      await creation.mutateAsync({
        compte: Number(formulaire.compte),
        date: formulaire.date,
        solde_physique: Number(formulaire.solde_physique),
      })
      toast.succes(
        'Arrêté enregistré',
        'Le solde théorique et l’écart sont calculés par le serveur.',
      )
      setOuverture(false)
      setFormulaire({ compte: '', date: aujourdhui(), solde_physique: '' })
      setSoldeTheorique(null)
      setErreurs({})
    } catch (error) {
      setErreurs((error as { fields?: Record<string, string[]> }).fields ?? {})
      toast.erreur('Enregistrement impossible', (error as Error).message)
    }
  }

  const colonnes: Column<ArreteCaisse>[] = [
    {
      key: 'compte',
      header: 'Compte',
      primary: true,
      render: (arrete) => (
        <span>
          <span className="block font-semibold">{arrete.compte_libelle}</span>
          <span className="text-xs text-[var(--muted-foreground)]">{arrete.compte_code}</span>
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      hideBelow: 'sm',
      render: (arrete) => dateCourte(arrete.date),
    },
    {
      key: 'theorique',
      header: 'Théorique',
      align: 'right',
      hideBelow: 'md',
      render: (arrete) => <span className="numeric">{fcfa(arrete.solde_theorique)}</span>,
    },
    {
      key: 'physique',
      header: 'Physique',
      align: 'right',
      render: (arrete) => <span className="numeric font-semibold">{fcfa(arrete.solde_physique)}</span>,
    },
    {
      key: 'ecart',
      header: 'Écart',
      align: 'right',
      render: (arrete) => (
        <span
          className={`numeric font-semibold ${
            Number(arrete.ecart) === 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'
          }`}
        >
          {fcfa(arrete.ecart)}
        </span>
      ),
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (arrete) => (
        <Badge tone={tonStatut(arrete.statut)}>
          {arrete.statut === 'VALIDE' ? 'Validé' : 'En cours'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (arrete) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            icon={<Scale className="size-4" aria-hidden />}
            onClick={(event) => {
              event.stopPropagation()
              setBilletage(arrete)
            }}
          >
            Billetage
          </Button>
          {arrete.statut === 'EN_COURS' && validation ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<BadgeCheck className="size-4" aria-hidden />}
              onClick={(event) => {
                event.stopPropagation()
                setAValider(arrete)
              }}
            >
              Valider
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Arrêtés de caisse"
        description="Contrôlez la caisse en comparant le solde théorique et le solde physique compté, coupure par coupure."
        actions={
          ecriture ? (
            <Button
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => setOuverture(true)}
            >
              Nouvel arrêté
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        actifs={[compte, statut].filter(Boolean).length}
        onReset={() => {
          setCompte('')
          setStatut('')
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
          label="Statut"
          value={statut}
          allLabel="Tous"
          options={[
            { value: 'EN_COURS', label: 'En cours' },
            { value: 'VALIDE', label: 'Validé' },
          ]}
          onChange={(value) => {
            setStatut(value)
            setPage(1)
          }}
        />
      </FilterBar>

      <DataTable
        columns={colonnes}
        rows={rows}
        rowKey={(arrete) => arrete.id}
        caption="Arrêtés de caisse"
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="Aucun arrêté de caisse"
        emptyDescription="Créez un arrêté pour justifier l’espèce présente en caisse à une date donnée."
        footer={<Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />}
      />

      <Dialog
        open={ouverture}
        onClose={() => setOuverture(false)}
        title="Nouvel arrêté de caisse"
        description="Le serveur calcule le solde théorique et refuse un doublon compte + date."
        footer={
          <>
            <Button variant="outline" onClick={() => setOuverture(false)}>
              Annuler
            </Button>
            <Button onClick={() => void soumettre()} loading={creation.isPending}>
              Enregistrer l’arrêté
            </Button>
          </>
        }
      >
        <FormGrid>
          <SelectField
            label="Compte"
            required
            value={formulaire.compte}
            error={erreurs.compte?.join(' ')}
            placeholder="— Sélectionner —"
            options={(comptes.data ?? []).map((item) => ({
              value: item.id,
              label: `${item.code} — ${item.libelle}`,
            }))}
            onChange={(event) => {
              setFormulaire((current) => ({ ...current, compte: event.target.value }))
              setSoldeTheorique(null)
            }}
          />
          <InputField
            label="Date de l’arrêté"
            type="date"
            required
            value={formulaire.date}
            error={erreurs.date?.join(' ')}
            onChange={(event) => {
              setFormulaire((current) => ({ ...current, date: event.target.value }))
              setSoldeTheorique(null)
            }}
          />
          <InputField
            label="Solde physique compté (FCFA)"
            type="number"
            inputMode="numeric"
            min={0}
            required
            value={formulaire.solde_physique}
            error={erreurs.solde_physique?.join(' ')}
            onChange={(event) =>
              setFormulaire((current) => ({ ...current, solde_physique: event.target.value }))
            }
          />
          <div className="flex flex-col justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              icon={<Calculator className="size-4" aria-hidden />}
              onClick={() => void calculerTheorique()}
            >
              Calculer le solde théorique
            </Button>
            <p className="text-xs text-[var(--muted-foreground)]">
              {soldeTheorique === null
                ? 'Prévisualisation indicative ; le calcul définitif est refait à l’enregistrement.'
                : `Théorique : ${fcfa(soldeTheorique)} · Écart : ${fcfa(ecart ?? 0)}`}
            </p>
          </div>
        </FormGrid>

        {ecart !== null && ecart !== 0 ? (
          <div className="mt-4">
            <InfoBanner
              tone={ecart > 0 ? 'success' : 'warning'}
              title={ecart > 0 ? 'Excédent de caisse' : 'Manquant de caisse'}
            >
              L’écart sera enregistré et visible dans le tableau de bord de trésorerie.
            </InfoBanner>
          </div>
        ) : null}
      </Dialog>

      <DialogBilletage arrete={billetage} onClose={() => setBilletage(null)} />

      <ConfirmDialog
        open={aValider !== null}
        onClose={() => setAValider(null)}
        onConfirm={async () => {
          try {
            await actionValider.mutateAsync({})
            toast.succes('Arrêté validé')
            setAValider(null)
          } catch (error) {
            toast.erreur('Validation impossible', (error as Error).message)
          }
        }}
        title="Valider l’arrêté de caisse ?"
        message={
          <>
            {aValider?.compte_libelle} — {aValider ? dateCourte(aValider.date) : ''}. Écart constaté :{' '}
            <strong>{fcfa(aValider?.ecart ?? 0)}</strong>. Un arrêté validé est définitif.
          </>
        }
        confirmLabel="Valider l’arrêté"
        loading={actionValider.isPending}
      />
    </>
  )
}

function DialogBilletage({
  arrete,
  onClose,
}: {
  arrete: ArreteCaisse | null
  onClose: () => void
}) {
  const toast = useToast()
  const [quantites, setQuantites] = useState<Record<number, string>>({})
  const enregistrement = useAction(`/api/v1/${T.arretes}/${arrete?.id ?? 0}/billetage_batch/`, [
    T.arretes,
    T.billetages,
  ])
  const billetages = useAll<Billetage>(T.billetages, { arrete_caisse: arrete?.id })

  const totalCompte = COUPURES.reduce(
    (sum, coupure) => sum + coupure * (Number(quantites[coupure]) || 0),
    0,
  )

  if (!arrete) return null

  return (
    <Dialog
      open
      onClose={onClose}
      title="Billetage de caisse"
      description={`${arrete.compte_libelle} — ${dateCourte(arrete.date)}. Solde physique : ${fcfa(arrete.solde_physique)}.`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          {arrete.statut === 'EN_COURS' ? (
            <Button
              loading={enregistrement.isPending}
              onClick={async () => {
                const payload = COUPURES.filter((coupure) => Number(quantites[coupure]) > 0).map(
                  (coupure) => ({ denomination: coupure, quantite: Number(quantites[coupure]) }),
                )
                if (payload.length === 0) {
                  toast.erreur('Billetage vide', 'Saisissez au moins une quantité.')
                  return
                }
                try {
                  await enregistrement.mutateAsync({ lignes: payload })
                  toast.succes('Billetage enregistré')
                  setQuantites({})
                  await billetages.refetch()
                } catch (error) {
                  toast.erreur('Enregistrement impossible', (error as Error).message)
                }
              }}
            >
              Enregistrer le billetage
            </Button>
          ) : null}
        </>
      }
    >
      {billetages.isLoading ? (
        <LoadingState />
      ) : (billetages.data ?? []).length > 0 ? (
        <section className="mb-4">
          <h3 className="mb-2 text-sm font-bold tracking-wide text-[var(--muted-foreground)] uppercase">
            Billetage déjà enregistré
          </h3>
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-control)] border border-[var(--border)]">
            {(billetages.data ?? []).map((ligne) => (
              <li key={ligne.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="numeric">
                  {fcfa(ligne.denomination)} × {ligne.quantite}
                </span>
                <span className="numeric font-semibold">{fcfa(ligne.montant)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {arrete.statut === 'EN_COURS' ? (
        <div className="grid gap-2 sm:grid-cols-2">
        {COUPURES.map((coupure) => (
          <label
            key={coupure}
            className="flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2"
          >
            <span className="numeric w-24 text-sm font-semibold">{fcfa(coupure)}</span>
            <span className="text-sm text-[var(--muted-foreground)]">×</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={quantites[coupure] ?? ''}
              onChange={(event) =>
                setQuantites((current) => ({ ...current, [coupure]: event.target.value }))
              }
              aria-label={`Nombre de billets ou pièces de ${coupure} FCFA`}
              placeholder="0"
              className="control h-10 min-h-10 w-24 py-1 text-right"
            />
            <span className="numeric ml-auto text-sm">
              {fcfa(coupure * (Number(quantites[coupure]) || 0))}
            </span>
          </label>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Arrêté validé"
          description="Un arrêté validé ne peut plus recevoir de lignes de billetage."
        />
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-[var(--surface-muted)] px-4 py-3">
        <span className="text-sm font-semibold">Total compté</span>
        <span className="numeric text-lg font-bold text-brand-700">{fcfa(totalCompte)}</span>
      </div>
    </Dialog>
  )
}
