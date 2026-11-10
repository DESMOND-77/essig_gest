import { ClipboardPlus, Eye } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { DataTable, Pagination, type Column } from '@/components/data/DataTable'
import { SearchSelect } from '@/components/data/SearchSelect'
import { FilterBar, SearchInput, SelectFilter } from '@/components/data/Toolbar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, tonStatut } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import {
  CheckboxField,
  FormGrid,
  InputField,
  SelectField,
} from '@/components/ui/FormField'
import { InfoBanner } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { aujourdhui, dateCourte, nomComplet } from '@/lib/format'
import { useCreate, useDebounced, usePagedList } from '@/lib/hooks'
import { ApiError } from '@/lib/http'
import type { Etudiant, Inscription } from '@/lib/types'
import {
  optionAnnee,
  optionClasse,
  useAnnees,
  useClasses,
  versOptions,
} from '@/referentiel/hooks'

export function InscriptionsPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'inscriptions')
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const etudiantInitial = searchParams.get('etudiant')

  const annees = useAnnees()
  const classes = useClasses()

  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const rechercheDebounced = useDebounced(recherche, 350)
  const [annee, setAnnee] = useState('')
  const [classe, setClasse] = useState('')
  const [etat, setEtat] = useState('')
  const [filtresOuverts, setFiltresOuverts] = useState(false)

  const [dialogue, setDialogue] = useState(Boolean(etudiantInitial))
  const [etudiantId, setEtudiantId] = useState<number | null>(
    etudiantInitial ? Number(etudiantInitial) : null,
  )
  const [formulaire, setFormulaire] = useState({
    classe: '',
    date_inscription: aujourdhui(),
    est_boursier: false,
    cout_scolarite_negocie: '',
    etablissement_provenance: '',
    etat: 'ACTIVE',
  })
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({})
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null)

  const query = usePagedList<Inscription>('personnes/inscriptions', {
    page,
    ...(rechercheDebounced ? { search: rechercheDebounced } : {}),
    ...(annee ? { annee_scolaire: annee } : {}),
    ...(classe ? { classe } : {}),
    ...(etat ? { etat } : {}),
    ordering: '-date_inscription',
  })
  const creation = useCreate<Inscription>('personnes/inscriptions')

  const rows = query.data?.results ?? []
  const total = query.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 25))
  const filtresActifs = [annee, classe, etat].filter(Boolean).length

  const colonnes = useMemo<Column<Inscription>[]>(
    () => [
      {
        key: 'etudiant',
        header: 'Étudiant',
        primary: true,
        render: (inscription) => (
          <Link
            to={`/inscriptions/${inscription.id}`}
            className="font-semibold text-[var(--foreground)] hover:text-brand-700"
            onClick={(event) => event.stopPropagation()}
          >
            {inscription.etudiant_libelle}
          </Link>
        ),
      },
      {
        key: 'numero_ordre',
        header: 'N° ordre',
        hideBelow: 'xl',
        render: (inscription) => (
          <span className="numeric text-[var(--muted-foreground)]">
            {inscription.numero_ordre}
          </span>
        ),
      },
      {
        key: 'classe',
        header: 'Classe',
        render: (inscription) => (
          <span className="text-sm">{inscription.classe_libelle}</span>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        hideBelow: 'lg',
        render: (inscription) => (
          <span className="text-sm">
            {inscription.type === 'REINSCRIPTION' ? 'Réinscription' : 'Inscription'}
          </span>
        ),
      },
      {
        key: 'etat',
        header: 'État',
        render: (inscription) => (
          <Badge tone={tonStatut(inscription.etat)}>
            {inscription.etat === 'ACTIVE'
              ? 'Active'
              : inscription.etat === 'DIPLOME'
                ? 'Diplômé'
                : inscription.etat === 'ABANDON'
                  ? 'Abandon'
                  : 'Exclu'}
          </Badge>
        ),
      },
      {
        key: 'date_inscription',
        header: 'Date',
        hideBelow: 'md',
        render: (inscription) => dateCourte(inscription.date_inscription),
      },
      {
        key: 'boursier',
        header: 'Boursier',
        hideBelow: 'lg',
        render: (inscription) =>
          inscription.est_boursier ? <Badge tone="accent">Oui</Badge> : '—',
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (inscription) => (
          <Link
            to={`/inscriptions/${inscription.id}`}
            aria-label="Ouvrir la fiche d’inscription"
            className="inline-grid size-9 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--brand-primary-subtle)] hover:text-brand-700"
          >
            <Eye className="size-4" aria-hidden />
          </Link>
        ),
      },
    ],
    [],
  )

  const soumettre = async () => {
    const manquants: Record<string, string[]> = {}
    if (!etudiantId) manquants.etudiant = ['Sélectionnez un étudiant.']
    if (!formulaire.classe) manquants.classe = ['Sélectionnez une classe.']
    if (!formulaire.date_inscription) manquants.date_inscription = ['Indiquez la date.']
    if (Object.keys(manquants).length > 0) {
      setErreurs(manquants)
      setErreurGlobale('Complétez les champs obligatoires.')
      return
    }

    try {
      const inscription = await creation.mutateAsync({
        etudiant: etudiantId,
        classe: Number(formulaire.classe),
        date_inscription: formulaire.date_inscription,
        est_boursier: formulaire.est_boursier,
        cout_scolarite_negocie: formulaire.cout_scolarite_negocie
          ? Number(formulaire.cout_scolarite_negocie)
          : null,
        etablissement_provenance: formulaire.etablissement_provenance || null,
        etat: formulaire.etat,
      })
      toast.succes(
        'Inscription créée',
        `N° ${inscription.numero_ordre} — l’échéancier et les frais obligatoires ont été générés.`,
      )
      setDialogue(false)
      setEtudiantId(null)
      setErreurs({})
      setErreurGlobale(null)
      setFormulaire({
        classe: '',
        date_inscription: aujourdhui(),
        est_boursier: false,
        cout_scolarite_negocie: '',
        etablissement_provenance: '',
        etat: 'ACTIVE',
      })
    } catch (error) {
      if (error instanceof ApiError) {
        setErreurs(error.fields ?? {})
        setErreurGlobale(
          error.status === 400
            ? 'Vérifiez les informations. Un étudiant ne peut avoir qu’une inscription par année.'
            : error.message,
        )
      } else {
        setErreurGlobale((error as Error).message)
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Inscriptions"
        description="Inscrire un étudiant dans une classe. Le numéro d’ordre, l’échéancier et les frais obligatoires sont générés par le serveur."
        actions={
          ecriture ? (
            <Button
              icon={<ClipboardPlus className="size-4" aria-hidden />}
              onClick={() => setDialogue(true)}
            >
              Nouvelle inscription
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
            placeholder="Rechercher par étudiant, matricule…"
          />
        }
        actifs={filtresActifs}
        mobileOpen={filtresOuverts}
        onToggleMobile={() => setFiltresOuverts((open) => !open)}
        onReset={() => {
          setAnnee('')
          setClasse('')
          setEtat('')
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
          label="Classe"
          value={classe}
          allLabel="Toutes"
          options={versOptions(classes.data, optionClasse)}
          onChange={(value) => {
            setClasse(value)
            setPage(1)
          }}
        />
        <SelectFilter
          label="État"
          value={etat}
          allLabel="Tous"
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'ABANDON', label: 'Abandon' },
            { value: 'EXCLU', label: 'Exclu' },
            { value: 'DIPLOME', label: 'Diplômé' },
          ]}
          onChange={(value) => {
            setEtat(value)
            setPage(1)
          }}
        />
      </FilterBar>

      <DataTable
        columns={colonnes}
        rows={rows}
        rowKey={(inscription) => inscription.id}
        caption="Liste des inscriptions"
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="Aucune inscription"
        emptyDescription={
          recherche || filtresActifs > 0
            ? 'Aucun résultat pour ces critères.'
            : 'Créez une inscription pour générer l’échéancier et les frais.'
        }
        footer={<Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />}
      />

      <Dialog
        open={dialogue}
        onClose={() => setDialogue(false)}
        title="Nouvelle inscription"
        description="L’école et l’année sont déduites de la classe. Le numéro d’ordre est attribué automatiquement."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogue(false)}>
              Annuler
            </Button>
            <Button onClick={() => void soumettre()} loading={creation.isPending}>
              Inscrire
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
          <SearchSelect<Etudiant>
            label="Étudiant"
            required
            resource="personnes/etudiants"
            value={etudiantId}
            onChange={setEtudiantId}
            error={erreurs.etudiant?.join(' ')}
            searchPlaceholder="Nom, prénom ou matricule…"
            toOption={(etudiant) => ({
              value: etudiant.id,
              label: nomComplet({ nom: etudiant.nom, prenoms: etudiant.prenoms }),
              description: etudiant.matricule,
            })}
          />

          <FormGrid>
            <SelectField
              label="Classe"
              required
              value={formulaire.classe}
              error={erreurs.classe?.join(' ')}
              placeholder="— Sélectionner —"
              options={versOptions(classes.data, optionClasse)}
              onChange={(event) =>
                setFormulaire((current) => ({ ...current, classe: event.target.value }))
              }
            />
            <InputField
              label="Date d’inscription"
              type="date"
              required
              value={formulaire.date_inscription}
              error={erreurs.date_inscription?.join(' ')}
              onChange={(event) =>
                setFormulaire((current) => ({ ...current, date_inscription: event.target.value }))
              }
            />
            <SelectField
              label="État"
              value={formulaire.etat}
              onChange={(event) =>
                setFormulaire((current) => ({ ...current, etat: event.target.value }))
              }
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'ABANDON', label: 'Abandon' },
                { value: 'EXCLU', label: 'Exclu' },
                { value: 'DIPLOME', label: 'Diplômé' },
              ]}
            />
            <InputField
              label="Scolarité négociée (FCFA)"
              type="number"
              min={0}
              inputMode="numeric"
              hint="Facultatif — sinon la grille tarifaire s’applique."
              value={formulaire.cout_scolarite_negocie}
              onChange={(event) =>
                setFormulaire((current) => ({
                  ...current,
                  cout_scolarite_negocie: event.target.value,
                }))
              }
            />
            <InputField
              label="Établissement de provenance"
              value={formulaire.etablissement_provenance}
              onChange={(event) =>
                setFormulaire((current) => ({
                  ...current,
                  etablissement_provenance: event.target.value,
                }))
              }
              containerClassName="md:col-span-2"
            />
            <CheckboxField
              label="Étudiant boursier"
              hint="La bourse se paramètre ensuite dans le module Bourses."
              checked={formulaire.est_boursier}
              onChange={(event) =>
                setFormulaire((current) => ({ ...current, est_boursier: event.target.checked }))
              }
              className="md:col-span-2"
            />
          </FormGrid>

          <InfoBanner tone="info" title="Généré automatiquement">
            L’échéancier (échéance 0 d’inscription + mensualités) et les frais obligatoires sont
            créés à partir de la grille tarifaire du niveau et de l’année.
          </InfoBanner>
        </div>
      </Dialog>
    </>
  )
}
