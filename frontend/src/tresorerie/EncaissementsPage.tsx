import { Banknote, CheckCheck, Plus, Receipt, Split, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DataTable, Pagination, type Column } from '@/components/data/DataTable'
import { SearchSelect } from '@/components/data/SearchSelect'
import { FilterBar, SearchInput, SelectFilter } from '@/components/data/Toolbar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, tonStatut } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { FormGrid, InputField, SelectField } from '@/components/ui/FormField'
import { InfoBanner, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { aujourdhui, dateCourte, fcfa } from '@/lib/format'
import { useAction, useAll, useCreate, useDebounced, useDetail, usePagedList } from '@/lib/hooks'
import { openDocument } from '@/lib/http'
import type { Encaissement, ImputationEncaissement, Inscription } from '@/lib/types'
import {
  libelleMode,
  libelleStatutEncaissement,
  T,
  useComptes,
} from './hooks'

export function EncaissementsPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'tresorerie')
  const validation = peutEcrire(user, 'tresorerieValidation')
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const inscriptionInitiale = searchParams.get('inscription')

  const comptes = useComptes()
  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const rechercheDebounced = useDebounced(recherche, 350)
  const [statut, setStatut] = useState('')
  const [mode, setMode] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filtresOuverts, setFiltresOuverts] = useState(false)

  const [dialogue, setDialogue] = useState(Boolean(inscriptionInitiale))
  const [inscriptionId, setInscriptionId] = useState<number | null>(
    inscriptionInitiale ? Number(inscriptionInitiale) : null,
  )
  const [formulaire, setFormulaire] = useState({
    montant_total: '',
    mode: 'ESPECES',
    compte: '',
    date: aujourdhui(),
  })
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({})
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null)

  const [aValider, setAValider] = useState<Encaissement | null>(null)
  const [aAnnuler, setAAnnuler] = useState<Encaissement | null>(null)
  const [aImputer, setAImputer] = useState<Encaissement | null>(null)

  const query = usePagedList<Encaissement>(T.encaissements, {
    page,
    ...(rechercheDebounced ? { search: rechercheDebounced } : {}),
    ...(statut ? { statut } : {}),
    ...(mode ? { mode } : {}),
    ...(dateDebut ? { date_debut: dateDebut } : {}),
    ...(dateFin ? { date_fin: dateFin } : {}),
    ordering: '-date',
  })
  const creation = useCreate<Encaissement>(T.encaissements)
  const actionValider = useAction(`/api/v1/${T.encaissements}/${aValider?.id ?? 0}/valider/`, [
    T.encaissements,
  ])
  const actionAnnuler = useAction(`/api/v1/${T.encaissements}/${aAnnuler?.id ?? 0}/annuler/`, [
    T.encaissements,
  ])

  const rows = query.data?.results ?? []
  const total = query.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 25))
  const filtresActifs = [statut, mode, dateDebut, dateFin].filter(Boolean).length

  useEffect(() => {
    if (!formulaire.compte && comptes.data?.length) {
      setFormulaire((current) => ({ ...current, compte: String(comptes.data?.[0]?.id ?? '') }))
    }
  }, [comptes.data, formulaire.compte])

  const colonnes: Column<Encaissement>[] = useMemo(
    () => [
      {
        key: 'recu_numero',
        header: 'Reçu',
        primary: true,
        render: (encaissement) => (
          <span className="font-semibold">{encaissement.recu_numero}</span>
        ),
      },
      {
        key: 'etudiant',
        header: 'Étudiant',
        render: (encaissement) => encaissement.inscription_etudiant_nom ?? '—',
      },
      {
        key: 'date',
        header: 'Date',
        hideBelow: 'md',
        render: (encaissement) => dateCourte(encaissement.date),
      },
      {
        key: 'montant',
        header: 'Montant',
        align: 'right',
        render: (encaissement) => (
          <span className="numeric font-semibold">{fcfa(encaissement.montant_total)}</span>
        ),
      },
      {
        key: 'mode',
        header: 'Mode',
        hideBelow: 'lg',
        render: (encaissement) => libelleMode[encaissement.mode] ?? encaissement.mode,
      },
      {
        key: 'compte',
        header: 'Compte',
        hideBelow: 'xl',
        render: (encaissement) => (
          <span className="text-[var(--muted-foreground)]">{encaissement.compte_code}</span>
        ),
      },
      {
        key: 'statut',
        header: 'Statut',
        render: (encaissement) => (
          <Badge tone={tonStatut(encaissement.statut)}>
            {libelleStatutEncaissement[encaissement.statut] ?? encaissement.statut}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (encaissement) => (
          <div className="flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              onClick={() =>
                void openDocument(`/api/v1/${T.encaissements}/${encaissement.id}/recu/`)
              }
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-[var(--brand-primary-subtle)]"
            >
              <Receipt className="size-4" aria-hidden />
              Reçu
            </button>
            {encaissement.statut === 'EN_COURS' && ecriture ? (
              <button
                type="button"
                onClick={() => setAImputer(encaissement)}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-[var(--brand-primary-subtle)]"
              >
                <Split className="size-4" aria-hidden />
                Imputer
              </button>
            ) : null}
            {encaissement.statut === 'EN_COURS' && validation ? (
              <>
                <button
                  type="button"
                  onClick={() => setAValider(encaissement)}
                  aria-label="Valider l’encaissement"
                  className="grid size-9 place-items-center rounded-lg text-[var(--success)] hover:bg-[var(--success-subtle)]"
                >
                  <CheckCheck className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setAAnnuler(encaissement)}
                  aria-label="Annuler l’encaissement"
                  className="grid size-9 place-items-center rounded-lg text-[var(--destructive)] hover:bg-[var(--destructive-subtle)]"
                >
                  <XCircle className="size-4" aria-hidden />
                </button>
              </>
            ) : null}
          </div>
        ),
      },
    ],
    [ecriture, validation],
  )

  const soumettre = async () => {
    const manquants: Record<string, string[]> = {}
    if (!inscriptionId) manquants.inscription = ['Sélectionnez une inscription.']
    if (!formulaire.montant_total || Number(formulaire.montant_total) <= 0)
      manquants.montant_total = ['Le montant doit être positif.']
    if (!formulaire.compte) manquants.compte = ['Sélectionnez un compte.']
    if (Object.keys(manquants).length > 0) {
      setErreurs(manquants)
      setErreurGlobale('Complétez les champs obligatoires.')
      return
    }

    try {
      await creation.mutateAsync({
        inscription: inscriptionId,
        montant_total: Number(formulaire.montant_total),
        mode: formulaire.mode,
        compte: Number(formulaire.compte),
        date: formulaire.date,
      })
      toast.succes(
        'Encaissement enregistré',
        'Le reçu est généré. Imputez maintenant le montant sur les échéances ou les frais.',
      )
      setDialogue(false)
      setInscriptionId(null)
      setFormulaire({
        montant_total: '',
        mode: 'ESPECES',
        compte: String(comptes.data?.[0]?.id ?? ''),
        date: aujourdhui(),
      })
      setErreurs({})
      setErreurGlobale(null)
    } catch (error) {
      setErreurs((error as { fields?: Record<string, string[]> }).fields ?? {})
      setErreurGlobale((error as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        title="Encaissements"
        description="Paiements reçus des étudiants. Chaque encaissement génère un reçu et un mouvement de crédit."
        actions={
          ecriture ? (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setDialogue(true)}>
              Nouvel encaissement
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        search={
          <SearchInput
            value={recherche}
            onChange={(value) => {
              setRecherche(value)
              setPage(1)
            }}
            placeholder="Rechercher par reçu, étudiant…"
          />
        }
        actifs={filtresActifs}
        mobileOpen={filtresOuverts}
        onToggleMobile={() => setFiltresOuverts((open) => !open)}
        onReset={() => {
          setStatut('')
          setMode('')
          setDateDebut('')
          setDateFin('')
          setPage(1)
        }}
      >
        <SelectFilter
          label="Statut"
          value={statut}
          allLabel="Tous"
          options={[
            { value: 'EN_COURS', label: 'En cours' },
            { value: 'VALIDE', label: 'Validé' },
            { value: 'ANNULE', label: 'Annulé' },
          ]}
          onChange={(value) => {
            setStatut(value)
            setPage(1)
          }}
        />
        <SelectFilter
          label="Mode"
          value={mode}
          allLabel="Tous"
          options={[
            { value: 'ESPECES', label: 'Espèces' },
            { value: 'MOBILE_MONEY', label: 'Mobile Money' },
            { value: 'VIREMENT', label: 'Virement' },
            { value: 'CHEQUE', label: 'Chèque' },
          ]}
          onChange={(value) => {
            setMode(value)
            setPage(1)
          }}
        />
        <label className="block min-w-0 flex-1 sm:w-40 sm:flex-none">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Du</span>
          <input
            type="date"
            value={dateDebut}
            onChange={(event) => {
              setDateDebut(event.target.value)
              setPage(1)
            }}
            className="control h-10 min-h-10 py-1 text-sm"
          />
        </label>
        <label className="block min-w-0 flex-1 sm:w-40 sm:flex-none">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Au</span>
          <input
            type="date"
            value={dateFin}
            onChange={(event) => {
              setDateFin(event.target.value)
              setPage(1)
            }}
            className="control h-10 min-h-10 py-1 text-sm"
          />
        </label>
      </FilterBar>

      <DataTable
        columns={colonnes}
        rows={rows}
        rowKey={(encaissement) => encaissement.id}
        caption="Liste des encaissements"
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="Aucun encaissement"
        emptyDescription="Les encaissements saisis apparaîtront ici avec leur reçu."
        footer={<Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />}
      />

      <Dialog
        open={dialogue}
        onClose={() => setDialogue(false)}
        title="Nouvel encaissement"
        description="Un reçu et un mouvement de crédit sont générés automatiquement."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogue(false)}>
              Annuler
            </Button>
            <Button
              icon={<Banknote className="size-4" aria-hidden />}
              onClick={() => void soumettre()}
              loading={creation.isPending}
            >
              Encaisser
            </Button>
          </>
        }
      >
        {erreurGlobale ? (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius-control)] border border-[var(--destructive)]/30 bg-[var(--destructive-subtle)] px-3 py-2 text-sm text-[var(--destructive)]"
          >
            {erreurGlobale}
          </div>
        ) : null}

        <div className="space-y-4">
          <SearchSelect<Inscription>
            label="Inscription de l’étudiant"
            required
            resource="personnes/inscriptions"
            value={inscriptionId}
            onChange={setInscriptionId}
            error={erreurs.inscription?.join(' ')}
            searchPlaceholder="Nom, matricule ou n° d’ordre…"
            params={{ etat: 'ACTIVE' }}
            toOption={(inscription) => ({
              value: inscription.id,
              label: inscription.etudiant_libelle,
              description: `#${inscription.numero_ordre} · ${inscription.classe_libelle}`,
            })}
          />

          <FormGrid>
            <InputField
              label="Montant reçu (FCFA)"
              type="number"
              inputMode="numeric"
              min={1}
              required
              value={formulaire.montant_total}
              error={erreurs.montant_total?.join(' ')}
              onChange={(event) =>
                setFormulaire((current) => ({ ...current, montant_total: event.target.value }))
              }
            />
            <InputField
              label="Date"
              type="date"
              required
              value={formulaire.date}
              error={erreurs.date?.join(' ')}
              onChange={(event) =>
                setFormulaire((current) => ({ ...current, date: event.target.value }))
              }
            />
            <SelectField
              label="Mode de paiement"
              required
              value={formulaire.mode}
              onChange={(event) =>
                setFormulaire((current) => ({ ...current, mode: event.target.value }))
              }
              options={[
                { value: 'ESPECES', label: 'Espèces' },
                { value: 'MOBILE_MONEY', label: 'Mobile Money' },
                { value: 'VIREMENT', label: 'Virement' },
                { value: 'CHEQUE', label: 'Chèque' },
              ]}
            />
            <SelectField
              label="Compte crédité"
              required
              value={formulaire.compte}
              error={erreurs.compte?.join(' ')}
              placeholder="— Sélectionner —"
              options={(comptes.data ?? []).map((compte) => ({
                value: compte.id,
                label: `${compte.code} — ${compte.libelle}`,
              }))}
              onChange={(event) =>
                setFormulaire((current) => ({ ...current, compte: event.target.value }))
              }
            />
          </FormGrid>

          <InfoBanner tone="info" title="Après l’encaissement">
            L’imputation sur les échéances ou les frais se fait depuis la ligne de l’encaissement.
            Le contrôle du reste à payer est réalisé par le serveur.
          </InfoBanner>
        </div>
      </Dialog>

      <DialogImputation
        encaissement={aImputer}
        onClose={() => setAImputer(null)}
        onDone={() => {
          setAImputer(null)
          void query.refetch()
        }}
      />

      <ConfirmDialog
        open={aValider !== null}
        onClose={() => setAValider(null)}
        onConfirm={async () => {
          try {
            await actionValider.mutateAsync({})
            toast.succes('Encaissement validé')
            setAValider(null)
          } catch (error) {
            toast.erreur('Validation impossible', (error as Error).message)
          }
        }}
        title="Valider l’encaissement ?"
        message={
          <>
            Le reçu <strong>{aValider?.recu_numero}</strong> deviendra définitif. Le montant et le
            mode ne pourront plus être modifiés.
          </>
        }
        confirmLabel="Valider"
        loading={actionValider.isPending}
      />

      <ConfirmDialog
        open={aAnnuler !== null}
        onClose={() => setAAnnuler(null)}
        onConfirm={async () => {
          try {
            await actionAnnuler.mutateAsync({})
            toast.succes('Encaissement annulé')
            setAAnnuler(null)
          } catch (error) {
            toast.erreur('Annulation impossible', (error as Error).message)
          }
        }}
        title="Annuler l’encaissement ?"
        message={
          <>
            Le reçu <strong>{aAnnuler?.recu_numero}</strong> sera annulé et une contre-écriture
            sera produite côté serveur.
          </>
        }
        confirmLabel="Annuler l’encaissement"
        cancelLabel="Fermer"
        danger
        loading={actionAnnuler.isPending}
      />
    </>
  )
}

function DialogImputation({
  encaissement,
  onClose,
  onDone,
}: {
  encaissement: Encaissement | null
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const inscription = useDetail<Inscription>(
    'personnes/inscriptions',
    encaissement?.inscription ?? null,
  )
  const [montants, setMontants] = useState<Record<string, string>>({})
  const dejaImpute = useAll<ImputationEncaissement>(T.imputations, {
    ...(encaissement ? { encaissement: encaissement.id } : {}),
  })
  const action = useAction(`/api/v1/${T.encaissements}/${encaissement?.id ?? 0}/imputer/`, [
    T.encaissements,
    T.imputations,
    'personnes/inscriptions',
  ])

  useEffect(() => {
    if (!inscription.data) return
    const suivants: Record<string, string> = {}
    for (const echeance of inscription.data.echeances ?? []) {
      const reste = Number(echeance.montant) - Number(echeance.montant_paye)
      if (reste > 0) suivants[`echeance-${echeance.id}`] = ''
    }
    for (const frais of inscription.data.frais_inscription ?? []) {
      if (!frais.exonere) suivants[`frais-${frais.id}`] = ''
    }
    setMontants(suivants)
  }, [inscription.data])

  const totalSaisi = Object.values(montants).reduce(
    (sum, valeur) => sum + (Number(valeur) || 0),
    0,
  )
  const montantEncaissement = Number(encaissement?.montant_total ?? 0)
  const dejaImputeTotal = (dejaImpute.data ?? []).reduce(
    (sum, imputation) => sum + Number(imputation.montant),
    0,
  )
  const restantAImputer = Math.max(0, montantEncaissement - dejaImputeTotal)

  /**
   * Répartit automatiquement le reste à imputer : échéances les plus anciennes
   * d'abord, puis frais annexes. Le serveur exige que le total des imputations
   * soit exactement égal au restant (ni plus, ni moins).
   */
  const repartir = () => {
    let restant = restantAImputer
    const suivants: Record<string, string> = {}
    const echeances = [...(inscription.data?.echeances ?? [])].sort(
      (a, b) => a.numero - b.numero,
    )
    for (const echeance of echeances) {
      if (restant <= 0) break
      const reste = Number(echeance.montant) - Number(echeance.montant_paye)
      if (reste <= 0) continue
      const montant = Math.min(reste, restant)
      suivants[`echeance-${echeance.id}`] = String(montant)
      restant -= montant
    }
    for (const frais of inscription.data?.frais_inscription ?? []) {
      if (restant <= 0) break
      if (frais.exonere) continue
      const montant = Math.min(Number(frais.montant_du), restant)
      if (montant > 0) {
        suivants[`frais-${frais.id}`] = String(montant)
        restant -= montant
      }
    }
    setMontants(suivants)
  }

  if (!encaissement) return null

  const soumettre = async () => {
    const imputations = Object.entries(montants)
      .filter(([, valeur]) => Number(valeur) > 0)
      .map(([cle, valeur]) => {
        const [type, id] = cle.split('-')
        return type === 'echeance'
          ? { cible: 'ECHEANCE', echeance_id: Number(id), montant: Number(valeur) }
          : { cible: 'FRAIS', frais_inscription_id: Number(id), montant: Number(valeur) }
      })

    if (imputations.length === 0) {
      toast.erreur('Aucune imputation', 'Saisissez au moins un montant.')
      return
    }
    if (Math.abs(totalSaisi - restantAImputer) > 0.5) {
      toast.erreur(
        'Montant incomplet',
        `Le serveur exige d’imputer exactement ${fcfa(restantAImputer)} : il reste ${
          restantAImputer - totalSaisi > 0
            ? `${fcfa(restantAImputer - totalSaisi)} à répartir`
            : `${fcfa(totalSaisi - restantAImputer)} en trop`
        }. Utilisez « Répartir automatiquement » si besoin.`,
      )
      return
    }

    try {
      await action.mutateAsync({ imputations })
      toast.succes('Imputation enregistrée', `${fcfa(totalSaisi)} répartis.`)
      onDone()
    } catch (error) {
      toast.erreur('Imputation impossible', (error as Error).message)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Imputer l’encaissement ${encaissement.recu_numero}`}
      description={`Reste à imputer : ${fcfa(restantAImputer)} sur ${fcfa(montantEncaissement)}. Le total saisi doit correspondre exactement.`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button
            variant="secondary"
            onClick={repartir}
            disabled={restantAImputer <= 0 || inscription.isLoading}
          >
            Répartir automatiquement
          </Button>
          <Button onClick={() => void soumettre()} loading={action.isPending}>
            Imputer {fcfa(totalSaisi)}
          </Button>
        </>
      }
    >
      {inscription.isLoading || dejaImpute.isLoading ? (
        <LoadingState />
      ) : restantAImputer <= 0 ? (
        <InfoBanner tone="success" title="Encaissement entièrement imputé">
          Aucun montant ne reste à répartir sur cet encaissement.
        </InfoBanner>
      ) : (
        <div className="space-y-4">
          <section>
            <h3 className="mb-2 text-sm font-bold tracking-wide text-[var(--muted-foreground)] uppercase">
              Échéances de scolarité
            </h3>
            <ul className="space-y-2">
              {(inscription.data?.echeances ?? []).map((echeance) => {
                const reste = Number(echeance.montant) - Number(echeance.montant_paye)
                return (
                  <li
                    key={echeance.id}
                    className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border)] p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {echeance.numero === 0
                          ? 'Frais d’inscription'
                          : `Mensualité ${echeance.numero}`}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Dû {fcfa(echeance.montant)} · reste {fcfa(Math.max(0, reste))} ·{' '}
                        {dateCourte(echeance.date_echeance)}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, reste)}
                      inputMode="numeric"
                      aria-label={`Montant à imputer sur ${echeance.numero === 0 ? 'les frais d’inscription' : `la mensualité ${echeance.numero}`}`}
                      value={montants[`echeance-${echeance.id}`] ?? ''}
                      disabled={reste <= 0}
                      onChange={(event) =>
                        setMontants((current) => ({
                          ...current,
                          [`echeance-${echeance.id}`]: event.target.value,
                        }))
                      }
                      placeholder="0"
                      className="control w-28 text-right"
                    />
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold tracking-wide text-[var(--muted-foreground)] uppercase">
              Frais annexes
            </h3>
            {(inscription.data?.frais_inscription ?? []).length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Aucun frais annexe.</p>
            ) : (
              <ul className="space-y-2">
                {(inscription.data?.frais_inscription ?? []).map((frais) => (
                  <li
                    key={frais.id}
                    className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border)] p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Frais #{frais.type_frais}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {frais.exonere ? 'Exonéré' : `Montant dû ${fcfa(frais.montant_du)}`}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      aria-label={`Montant à imputer sur le frais ${frais.type_frais}`}
                      value={montants[`frais-${frais.id}`] ?? ''}
                      disabled={frais.exonere}
                      onChange={(event) =>
                        setMontants((current) => ({
                          ...current,
                          [`frais-${frais.id}`]: event.target.value,
                        }))
                      }
                      placeholder="0"
                      className="control w-28 text-right"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <InfoBanner tone="warning" title="Contrôle du reste à payer">
            Le serveur refuse une imputation supérieure au reste dû de chaque ligne et exige un
            total strictement égal au reste à imputer ({fcfa(restantAImputer)}).
          </InfoBanner>
          <p className="text-right text-sm font-semibold">
            Total imputé : <span className="numeric">{fcfa(totalSaisi)}</span>
          </p>
        </div>
      )}
    </Dialog>
  )
}
