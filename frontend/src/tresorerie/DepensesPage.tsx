import { CheckCheck, CreditCard, Plus, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { DataTable, Pagination, type Column } from '@/components/data/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '@/components/data/Toolbar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, tonStatut } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { FormGrid, InputField, SelectField, TextareaField } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { aujourdhui, dateCourte, fcfa } from '@/lib/format'
import { useAction, useCreate, useDebounced, usePagedList } from '@/lib/hooks'
import type { Depense } from '@/lib/types'
import { optionAnnee, optionEcole, useAnnees, useEcoles, versOptions } from '@/referentiel/hooks'
import { T, useCategories, useComptes } from './hooks'

export function DepensesPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'tresorerie')
  const validation = peutEcrire(user, 'tresorerieValidation')
  const toast = useToast()

  const comptes = useComptes()
  const categories = useCategories('SORTIE')
  const annees = useAnnees()
  const ecoles = useEcoles()

  const [page, setPage] = useState(1)
  const [beneficiaireFiltre, setBeneficiaireFiltre] = useState('')
  const beneficiaireDebounced = useDebounced(beneficiaireFiltre, 350)
  const [statut, setStatut] = useState('')
  const [compteFiltre, setCompteFiltre] = useState('')
  const [filtresOuverts, setFiltresOuverts] = useState(false)

  const [dialogue, setDialogue] = useState(false)
  const [formulaire, setFormulaire] = useState({
    date: aujourdhui(),
    categorie_mouvement: '',
    beneficiaire: '',
    designation: '',
    montant: '',
    compte: '',
    ecole: '',
    annee_scolaire: '',
    piece_justificative: '',
  })
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({})
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null)
  const [aValider, setAValider] = useState<Depense | null>(null)
  const [aPayer, setAPayer] = useState<Depense | null>(null)
  const [aAnnuler, setAAnnuler] = useState<Depense | null>(null)

  const query = usePagedList<Depense>(T.depenses, {
    page,
    ...(beneficiaireDebounced ? { beneficiaire: beneficiaireDebounced } : {}),
    ...(statut ? { statut } : {}),
    ...(compteFiltre ? { compte: compteFiltre } : {}),
  })
  const creation = useCreate<Depense>(T.depenses)
  const actionValider = useAction(`/api/v1/${T.depenses}/${aValider?.id ?? 0}/valider/`, [T.depenses])
  const actionAnnuler = useAction(`/api/v1/${T.depenses}/${aAnnuler?.id ?? 0}/annuler/`, [T.depenses])
  const actionPayer = useAction(`/api/v1/${T.depenses}/${aPayer?.id ?? 0}/payer/`, [T.depenses])

  useEffect(() => {
    setFormulaire((current) => ({
      ...current,
      compte: current.compte || String(comptes.data?.[0]?.id ?? ''),
      categorie_mouvement: current.categorie_mouvement || String(categories.data?.[0]?.id ?? ''),
      annee_scolaire:
        current.annee_scolaire ||
        String(annees.data?.find((annee) => annee.est_courante)?.id ?? annees.data?.[0]?.id ?? ''),
    }))
  }, [comptes.data, categories.data, annees.data])

  const rows = query.data?.results ?? []
  const total = query.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 25))

  const colonnes = useMemo<Column<Depense>[]>(
    () => [
      {
        key: 'designation',
        header: 'Dépense',
        primary: true,
        render: (depense) => <span className="font-semibold">{depense.designation}</span>,
      },
      {
        key: 'beneficiaire',
        header: 'Bénéficiaire',
        render: (depense) => depense.beneficiaire,
      },
      {
        key: 'date',
        header: 'Date',
        hideBelow: 'md',
        render: (depense) => dateCourte(depense.date),
      },
      {
        key: 'categorie',
        header: 'Catégorie',
        hideBelow: 'xl',
        render: (depense) => depense.categorie_mouvement_libelle,
      },
      {
        key: 'montant',
        header: 'Montant',
        align: 'right',
        render: (depense) => <span className="numeric font-semibold">{fcfa(depense.montant)}</span>,
      },
      {
        key: 'statut',
        header: 'Statut',
        render: (depense) => (
          <Badge tone={tonStatut(depense.statut)}>
            {depense.statut === 'ENGAGEE'
              ? 'Engagée'
              : depense.statut === 'VALIDEE'
                ? 'Validée'
                : depense.statut === 'PAYEE'
                  ? 'Payée'
                  : 'Annulée'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (depense) => (
          <div className="flex items-center justify-end gap-1">
            {depense.statut === 'VALIDEE' && ecriture ? (
              <button
                type="button"
                onClick={() => setAPayer(depense)}
                aria-label="Marquer la dépense payée"
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-[var(--brand-primary-subtle)]"
              >
                <CreditCard className="size-4" aria-hidden />
                Payer
              </button>
            ) : null}
            {depense.statut === 'ENGAGEE' && validation ? (
              <button
                type="button"
                onClick={() => setAValider(depense)}
                aria-label="Valider la dépense"
                className="grid size-9 place-items-center rounded-lg text-[var(--success)] hover:bg-[var(--success-subtle)]"
              >
                <CheckCheck className="size-4" aria-hidden />
              </button>
            ) : null}
            {depense.statut !== 'ANNULEE' && depense.statut !== 'PAYEE' && validation ? (
              <button
                type="button"
                onClick={() => setAAnnuler(depense)}
                aria-label="Annuler la dépense"
                className="grid size-9 place-items-center rounded-lg text-[var(--destructive)] hover:bg-[var(--destructive-subtle)]"
              >
                <XCircle className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [ecriture, validation],
  )

  const soumettre = async () => {
    const manquants: Record<string, string[]> = {}
    if (!formulaire.categorie_mouvement) manquants.categorie_mouvement = ['Catégorie requise.']
    if (!formulaire.beneficiaire.trim()) manquants.beneficiaire = ['Bénéficiaire requis.']
    if (!formulaire.designation.trim()) manquants.designation = ['Désignation requise.']
    if (!formulaire.montant || Number(formulaire.montant) <= 0) manquants.montant = ['Montant requis.']
    if (!formulaire.compte) manquants.compte = ['Compte requis.']
    if (!formulaire.annee_scolaire) manquants.annee_scolaire = ['Année requise.']
    if (Object.keys(manquants).length > 0) {
      setErreurs(manquants)
      setErreurGlobale('Complétez les champs obligatoires.')
      return
    }

    try {
      await creation.mutateAsync({
        date: formulaire.date,
        categorie_mouvement: Number(formulaire.categorie_mouvement),
        beneficiaire: formulaire.beneficiaire.trim(),
        designation: formulaire.designation.trim(),
        montant: Number(formulaire.montant),
        compte: Number(formulaire.compte),
        ecole: formulaire.ecole ? Number(formulaire.ecole) : null,
        annee_scolaire: Number(formulaire.annee_scolaire),
        piece_justificative: formulaire.piece_justificative || null,
      })
      toast.succes('Dépense engagée', 'Elle doit être validée avant d’être payée.')
      setDialogue(false)
      setErreurs({})
      setErreurGlobale(null)
      setFormulaire((current) => ({
        ...current,
        beneficiaire: '',
        designation: '',
        montant: '',
        piece_justificative: '',
        date: aujourdhui(),
      }))
    } catch (error) {
      setErreurs((error as { fields?: Record<string, string[]> }).fields ?? {})
      setErreurGlobale((error as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        title="Dépenses"
        description="Dépenses engagées par le groupe. Une dépense suit le circuit engagée → validée → payée, avec un mouvement de débit."
        actions={
          ecriture ? (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setDialogue(true)}>
              Nouvelle dépense
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        search={
          <SearchInput
            value={beneficiaireFiltre}
            onChange={(value) => {
              setBeneficiaireFiltre(value)
              setPage(1)
            }}
            placeholder="Rechercher un bénéficiaire…"
          />
        }
        actifs={[statut, compteFiltre, beneficiaireFiltre].filter(Boolean).length}
        mobileOpen={filtresOuverts}
        onToggleMobile={() => setFiltresOuverts((open) => !open)}
        onReset={() => {
          setStatut('')
          setCompteFiltre('')
          setBeneficiaireFiltre('')
          setPage(1)
        }}
      >
        <SelectFilter
          label="Statut"
          value={statut}
          allLabel="Tous"
          options={[
            { value: 'ENGAGEE', label: 'Engagée' },
            { value: 'VALIDEE', label: 'Validée' },
            { value: 'PAYEE', label: 'Payée' },
            { value: 'ANNULEE', label: 'Annulée' },
          ]}
          onChange={(value) => {
            setStatut(value)
            setPage(1)
          }}
        />
        <SelectFilter
          label="Compte"
          value={compteFiltre}
          allLabel="Tous"
          options={(comptes.data ?? []).map((compte) => ({
            value: compte.id,
            label: compte.code,
          }))}
          onChange={(value) => {
            setCompteFiltre(value)
            setPage(1)
          }}
        />
      </FilterBar>

      <DataTable
        columns={colonnes}
        rows={rows}
        rowKey={(depense) => depense.id}
        caption="Liste des dépenses"
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="Aucune dépense"
        emptyDescription="Enregistrez une dépense pour créer le mouvement de débit correspondant."
        footer={<Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />}
      />

      <Dialog
        open={dialogue}
        onClose={() => setDialogue(false)}
        title="Nouvelle dépense"
        description="Le mouvement de débit est créé automatiquement sur le compte choisi."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogue(false)}>
              Annuler
            </Button>
            <Button
              icon={<CreditCard className="size-4" aria-hidden />}
              onClick={() => void soumettre()}
              loading={creation.isPending}
            >
              Engager la dépense
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

        <FormGrid>
          <InputField
            label="Date"
            type="date"
            required
            value={formulaire.date}
            onChange={(event) => setFormulaire((current) => ({ ...current, date: event.target.value }))}
          />
          <SelectField
            label="Catégorie (sortie)"
            required
            value={formulaire.categorie_mouvement}
            error={erreurs.categorie_mouvement?.join(' ')}
            placeholder="— Sélectionner —"
            options={(categories.data ?? []).map((categorie) => ({
              value: categorie.id,
              label: `${categorie.code} — ${categorie.libelle}`,
            }))}
            onChange={(event) =>
              setFormulaire((current) => ({ ...current, categorie_mouvement: event.target.value }))
            }
          />
          <InputField
            label="Bénéficiaire"
            required
            value={formulaire.beneficiaire}
            error={erreurs.beneficiaire?.join(' ')}
            onChange={(event) =>
              setFormulaire((current) => ({ ...current, beneficiaire: event.target.value }))
            }
          />
          <InputField
            label="Montant (FCFA)"
            type="number"
            inputMode="numeric"
            min={1}
            required
            value={formulaire.montant}
            error={erreurs.montant?.join(' ')}
            onChange={(event) => setFormulaire((current) => ({ ...current, montant: event.target.value }))}
          />
          <TextareaField
            label="Désignation"
            required
            value={formulaire.designation}
            error={erreurs.designation?.join(' ')}
            onChange={(event) =>
              setFormulaire((current) => ({ ...current, designation: event.target.value }))
            }
            containerClassName="md:col-span-2"
          />
          <SelectField
            label="Compte débité"
            required
            value={formulaire.compte}
            error={erreurs.compte?.join(' ')}
            options={(comptes.data ?? []).map((compte) => ({
              value: compte.id,
              label: `${compte.code} — ${compte.libelle}`,
            }))}
            onChange={(event) => setFormulaire((current) => ({ ...current, compte: event.target.value }))}
          />
          <SelectField
            label="Année scolaire"
            required
            value={formulaire.annee_scolaire}
            error={erreurs.annee_scolaire?.join(' ')}
            options={versOptions(annees.data, optionAnnee)}
            onChange={(event) =>
              setFormulaire((current) => ({ ...current, annee_scolaire: event.target.value }))
            }
          />
          <SelectField
            label="École"
            value={formulaire.ecole}
            placeholder="Toutes / non affectée"
            options={versOptions(ecoles.data, optionEcole)}
            onChange={(event) => setFormulaire((current) => ({ ...current, ecole: event.target.value }))}
          />
          <InputField
            label="Pièce justificative"
            value={formulaire.piece_justificative}
            onChange={(event) =>
              setFormulaire((current) => ({ ...current, piece_justificative: event.target.value }))
            }
          />
        </FormGrid>
      </Dialog>

      <ConfirmDialog
        open={aValider !== null}
        onClose={() => setAValider(null)}
        onConfirm={async () => {
          try {
            await actionValider.mutateAsync({})
            toast.succes('Dépense validée')
            setAValider(null)
          } catch (error) {
            toast.erreur('Validation impossible', (error as Error).message)
          }
        }}
        title="Valider la dépense ?"
        message={
          <>
            <strong>{aValider?.designation}</strong> — {fcfa(aValider?.montant ?? 0)}. Une dépense
            validée ne peut plus être modifiée.
          </>
        }
        confirmLabel="Valider"
        loading={actionValider.isPending}
      />

      <ConfirmDialog
        open={aPayer !== null}
        onClose={() => setAPayer(null)}
        onConfirm={async () => {
          try {
            await actionPayer.mutateAsync({})
            toast.succes('Dépense payée', 'Le décaissement est enregistré.')
            setAPayer(null)
          } catch (error) {
            toast.erreur('Paiement impossible', (error as Error).message)
          }
        }}
        title="Marquer la dépense comme payée ?"
        message={
          <>
            <strong>{aPayer?.designation}</strong> — {fcfa(aPayer?.montant ?? 0)}. Confirmez que le
            décaissement a effectivement eu lieu.
          </>
        }
        confirmLabel="Confirmer le paiement"
        loading={actionPayer.isPending}
      />

      <ConfirmDialog
        open={aAnnuler !== null}
        onClose={() => setAAnnuler(null)}
        onConfirm={async () => {
          try {
            await actionAnnuler.mutateAsync({})
            toast.succes('Dépense annulée')
            setAAnnuler(null)
          } catch (error) {
            toast.erreur('Annulation impossible', (error as Error).message)
          }
        }}
        title="Annuler la dépense ?"
        message="La contre-écriture est produite par le serveur ; la ligne reste tracée."
        confirmLabel="Annuler la dépense"
        cancelLabel="Fermer"
        danger
        loading={actionAnnuler.isPending}
      />
    </>
  )
}
