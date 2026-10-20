import { Award, Plus } from 'lucide-react'
import { useState } from 'react'

import { DataTable, Pagination, type Column } from '@/components/data/DataTable'
import { SearchSelect } from '@/components/data/SearchSelect'
import { FilterBar, SelectFilter } from '@/components/data/Toolbar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, InputField, SelectField } from '@/components/ui/FormField'
import { InfoBanner } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { aujourdhui, dateCourte, fcfa, nomComplet } from '@/lib/format'
import { useCreate, usePagedList } from '@/lib/hooks'
import type { Bourse, Etudiant } from '@/lib/types'
import { optionAnnee, useAnnees, versOptions } from '@/referentiel/hooks'

const TYPES = [
  { value: 'TOTAL', label: 'Bourse totale' },
  { value: 'PARTIELLE', label: 'Bourse partielle' },
  { value: 'MERITE', label: 'Bourse au mérite' },
  { value: 'SOCIALE', label: 'Bourse sociale' },
]

export function BoursesPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'scolariteFrais')
  const toast = useToast()
  const annees = useAnnees()

  const [page, setPage] = useState(1)
  const [type, setType] = useState('')
  const [annee, setAnnee] = useState('')
  const [dialogue, setDialogue] = useState(false)
  const [etudiant, setEtudiant] = useState<number | null>(null)
  const [formulaire, setFormulaire] = useState({
    type: 'PARTIELLE',
    pourcentage: '',
    montant_fixe: '',
    date_attribution: aujourdhui(),
    date_fin_validite: '',
  })
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({})

  const query = usePagedList<Bourse>('scolarite/bourses', {
    page,
    ...(type ? { type } : {}),
    ...(annee ? { annee_scolaire: annee } : {}),
    ordering: '-date_attribution',
  })
  const creation = useCreate<Bourse>('scolarite/bourses')

  const rows = query.data?.results ?? []
  const total = query.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 25))

  const colonnes: Column<Bourse>[] = [
    {
      key: 'etudiant',
      header: 'Étudiant',
      primary: true,
      render: (bourse) => <span className="font-semibold">Étudiant #{bourse.etudiant}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (bourse) => (
        <Badge tone="brand">
          {TYPES.find((item) => item.value === bourse.type)?.label ?? bourse.type}
        </Badge>
      ),
    },
    {
      key: 'valeur',
      header: 'Valeur',
      align: 'right',
      render: (bourse) =>
        bourse.pourcentage !== null
          ? `${Number(bourse.pourcentage)} %`
          : fcfa(bourse.montant_fixe ?? 0),
    },
    {
      key: 'attribution',
      header: 'Attribution',
      hideBelow: 'md',
      render: (bourse) => dateCourte(bourse.date_attribution),
    },
    {
      key: 'validite',
      header: 'Validité',
      hideBelow: 'lg',
      render: (bourse) =>
        bourse.date_fin_validite ? dateCourte(bourse.date_fin_validite) : 'Jusqu’à la fin de l’année',
    },
  ]

  const soumettre = async () => {
    const manquants: Record<string, string[]> = {}
    if (!etudiant) manquants.etudiant = ['Sélectionnez un étudiant.']
    if (!annee) manquants.annee_scolaire = ['Choisissez une année.']
    if (!formulaire.pourcentage && !formulaire.montant_fixe)
      manquants.pourcentage = ['Renseignez un pourcentage ou un montant fixe.']
    if (formulaire.pourcentage && formulaire.montant_fixe)
      manquants.pourcentage = ['Choisissez un pourcentage OU un montant fixe, pas les deux.']
    if (Object.keys(manquants).length > 0) {
      setErreurs(manquants)
      return
    }

    try {
      await creation.mutateAsync({
        etudiant,
        annee_scolaire: Number(annee),
        type: formulaire.type,
        pourcentage: formulaire.pourcentage ? Number(formulaire.pourcentage) : null,
        montant_fixe: formulaire.montant_fixe ? Number(formulaire.montant_fixe) : null,
        date_attribution: formulaire.date_attribution,
        date_fin_validite: formulaire.date_fin_validite || null,
      })
      toast.succes('Bourse attribuée')
      setDialogue(false)
      setEtudiant(null)
      setErreurs({})
      setFormulaire((current) => ({
        ...current,
        pourcentage: '',
        montant_fixe: '',
        date_fin_validite: '',
      }))
      await query.refetch()
    } catch (error) {
      setErreurs((error as { fields?: Record<string, string[]> }).fields ?? {})
      toast.erreur('Attribution impossible', (error as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        title="Bourses"
        description="Bourses totales, partielles, au mérite ou sociales, exprimées en pourcentage ou en montant fixe."
        actions={
          ecriture ? (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setDialogue(true)}>
              Attribuer une bourse
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        actifs={[type, annee].filter(Boolean).length}
        onReset={() => {
          setType('')
          setAnnee('')
          setPage(1)
        }}
      >
        <SelectFilter
          label="Type"
          value={type}
          allLabel="Tous"
          options={TYPES}
          onChange={(value) => {
            setType(value)
            setPage(1)
          }}
        />
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
      </FilterBar>

      <DataTable
        columns={colonnes}
        rows={rows}
        rowKey={(bourse) => bourse.id}
        caption="Bourses attribuées"
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="Aucune bourse"
        emptyDescription="Attribuez une bourse à un étudiant pour réduire sa scolarité."
        footer={<Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />}
      />

      <Dialog
        open={dialogue}
        onClose={() => setDialogue(false)}
        title="Attribuer une bourse"
        description="La bourse est appliquée à la scolarité de l’année choisie."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogue(false)}>
              Annuler
            </Button>
            <Button
              icon={<Award className="size-4" aria-hidden />}
              onClick={() => void soumettre()}
              loading={creation.isPending}
            >
              Attribuer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <SearchSelect<Etudiant>
            label="Étudiant"
            required
            resource="personnes/etudiants"
            value={etudiant}
            onChange={setEtudiant}
            error={erreurs.etudiant?.join(' ')}
            searchPlaceholder="Nom, prénom ou matricule…"
            toOption={(item) => ({
              value: item.id,
              label: nomComplet(item),
              description: item.matricule,
            })}
          />

          <FormGrid>
            <SelectField
              label="Année scolaire"
              required
              value={annee}
              error={erreurs.annee_scolaire?.join(' ')}
              placeholder="— Sélectionner —"
              options={versOptions(annees.data, optionAnnee)}
              onChange={(event) => setAnnee(event.target.value)}
            />
            <SelectField
              label="Type de bourse"
              required
              value={formulaire.type}
              options={TYPES}
              onChange={(event) =>
                setFormulaire((current) => ({ ...current, type: event.target.value }))
              }
            />
            <InputField
              label="Pourcentage (%)"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={formulaire.pourcentage}
              error={erreurs.pourcentage?.join(' ')}
              onChange={(event) =>
                setFormulaire((current) => ({
                  ...current,
                  pourcentage: event.target.value,
                  montant_fixe: event.target.value ? '' : current.montant_fixe,
                }))
              }
            />
            <InputField
              label="Montant fixe (FCFA)"
              type="number"
              min={0}
              value={formulaire.montant_fixe}
              error={erreurs.montant_fixe?.join(' ')}
              onChange={(event) =>
                setFormulaire((current) => ({
                  ...current,
                  montant_fixe: event.target.value,
                  pourcentage: event.target.value ? '' : current.pourcentage,
                }))
              }
            />
            <InputField
              label="Date d’attribution"
              type="date"
              required
              value={formulaire.date_attribution}
              onChange={(event) =>
                setFormulaire((current) => ({ ...current, date_attribution: event.target.value }))
              }
            />
            <InputField
              label="Fin de validité"
              type="date"
              value={formulaire.date_fin_validite}
              onChange={(event) =>
                setFormulaire((current) => ({ ...current, date_fin_validite: event.target.value }))
              }
            />
          </FormGrid>

          <InfoBanner tone="info" title="Pourcentage ou montant">
            Une bourse s’exprime <strong>soit</strong> en pourcentage <strong>soit</strong> en montant
            fixe — le serveur refuse les deux à la fois.
          </InfoBanner>
        </div>
      </Dialog>
    </>
  )
}
