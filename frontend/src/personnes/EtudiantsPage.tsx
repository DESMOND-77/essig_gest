import { Eye, Plus, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable, Pagination, type Column } from '@/components/data/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '@/components/data/Toolbar'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import {
  FormGrid,
  FormSection,
  InputField,
  SelectField,
  TextareaField,
} from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { dateCourte, initiales, nomComplet } from '@/lib/format'
import { useCreate, useDebounced, usePagedList } from '@/lib/hooks'
import { ApiError } from '@/lib/http'
import type { Etudiant } from '@/lib/types'
import { useEcoles } from '@/referentiel/hooks'

interface FormulaireEtudiant {
  nom: string
  prenoms: string
  sexe: string
  date_naissance: string
  lieu_naissance: string
  nationalite: string
  email: string
  telephone: string
  adresse: string
  situation_matrimoniale: string
  ecole_sigle: string
}

const VIDE: FormulaireEtudiant = {
  nom: '',
  prenoms: '',
  sexe: 'M',
  date_naissance: '',
  lieu_naissance: '',
  nationalite: 'Gabonaise',
  email: '',
  telephone: '',
  adresse: '',
  situation_matrimoniale: '',
  ecole_sigle: '',
}

export function EtudiantsPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'personnes')
  const toast = useToast()
  const ecoles = useEcoles()

  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const rechercheDebounced = useDebounced(recherche, 350)
  const [sexe, setSexe] = useState('')
  const [bac, setBac] = useState('')
  const [filtresOuverts, setFiltresOuverts] = useState(false)
  const [dialogueOuvert, setDialogueOuvert] = useState(false)
  const [valeurs, setValeurs] = useState<FormulaireEtudiant>(VIDE)
  const [erreurs, setErreurs] = useState<Record<string, string[]>>({})
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null)

  const query = usePagedList<Etudiant>('personnes/etudiants', {
    page,
    ...(rechercheDebounced ? { search: rechercheDebounced } : {}),
    ...(sexe ? { sexe } : {}),
    ...(bac ? { a_le_bac: bac } : {}),
    ordering: 'nom',
  })
  const creation = useCreate<Etudiant>('personnes/etudiants')

  const rows = query.data?.results ?? []
  const total = query.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 25))
  const filtresActifs = [sexe, bac].filter(Boolean).length

  const changer = (champ: keyof FormulaireEtudiant, valeur: string) =>
    setValeurs((current) => ({ ...current, [champ]: valeur }))

  const colonnes = useMemo<Column<Etudiant>[]>(
    () => [
      {
        key: 'nom',
        header: 'Étudiant',
        primary: true,
        sortable: true,
        render: (etudiant) => (
          <Link
            to={`/etudiants/${etudiant.id}`}
            className="flex items-center gap-2.5 font-semibold text-[var(--foreground)] hover:text-brand-700"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--brand-primary-subtle)] text-[11px] font-bold text-brand-700">
              {initiales(etudiant.nom, etudiant.prenoms)}
            </span>
            <span className="min-w-0">
              <span className="block truncate">{nomComplet({ nom: etudiant.nom, prenoms: etudiant.prenoms })}</span>
              <span className="block text-xs font-normal text-[var(--muted-foreground)]">
                {etudiant.matricule}
              </span>
            </span>
          </Link>
        ),
      },
      {
        key: 'matricule',
        header: 'Matricule',
        hideBelow: 'xl',
        render: (etudiant) => <span className="numeric">{etudiant.matricule}</span>,
      },
      {
        key: 'sexe',
        header: 'Sexe',
        render: (etudiant) => (
          <Badge tone={etudiant.sexe === 'F' ? 'accent' : 'neutral'}>
            {etudiant.sexe === 'F' ? 'Féminin' : 'Masculin'}
          </Badge>
        ),
      },
      {
        key: 'date_naissance',
        header: 'Naissance',
        hideBelow: 'md',
        render: (etudiant) => dateCourte(etudiant.date_naissance),
      },
      {
        key: 'telephone',
        header: 'Téléphone',
        hideBelow: 'lg',
        render: (etudiant) => etudiant.telephone ?? '—',
      },
      {
        key: 'etablissement',
        header: 'Provenance',
        hideBelow: 'xl',
        render: (etudiant) => (
          <span className="line-clamp-1 max-w-48 text-[var(--muted-foreground)]">
            {etudiant.situation_bac?.etablissement ?? '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (etudiant) => (
          <Link
            to={`/etudiants/${etudiant.id}`}
            aria-label={`Voir la fiche de ${etudiant.nom} ${etudiant.prenoms}`}
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
    if (!valeurs.nom.trim()) manquants.nom = ['Le nom est obligatoire.']
    if (!valeurs.prenoms.trim()) manquants.prenoms = ['Les prénoms sont obligatoires.']
    if (!valeurs.ecole_sigle) manquants.ecole_sigle = ['Sélectionnez l’école pour le matricule.']
    if (Object.keys(manquants).length > 0) {
      setErreurs(manquants)
      setErreurGlobale('Complétez les champs obligatoires.')
      return
    }

    const payload: Record<string, unknown> = {
      nom: valeurs.nom.trim(),
      prenoms: valeurs.prenoms.trim(),
      sexe: valeurs.sexe,
      ecole_sigle: valeurs.ecole_sigle,
      nationalite: valeurs.nationalite || null,
      date_naissance: valeurs.date_naissance || null,
      lieu_naissance: valeurs.lieu_naissance || null,
      email: valeurs.email || null,
      telephone: valeurs.telephone || null,
      adresse: valeurs.adresse || null,
      situation_matrimoniale: valeurs.situation_matrimoniale || null,
    }

    try {
      await creation.mutateAsync(payload)
      toast.succes('Étudiant enregistré', 'Le matricule a été généré automatiquement.')
      setDialogueOuvert(false)
      setValeurs(VIDE)
      setErreurs({})
      setErreurGlobale(null)
    } catch (error) {
      if (error instanceof ApiError) {
        setErreurs(error.fields ?? {})
        setErreurGlobale(error.status === 400 ? 'Vérifiez les informations saisies.' : error.message)
      } else {
        setErreurGlobale((error as Error).message)
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Étudiants"
        description="Identités des étudiants. Le matricule est généré par le serveur à partir du sigle de l’école et des initiales."
        actions={
          ecriture ? (
            <Button
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => {
                setValeurs({ ...VIDE, ecole_sigle: ecoles.data?.[0]?.sigle ?? '' })
                setErreurs({})
                setErreurGlobale(null)
                setDialogueOuvert(true)
              }}
            >
              Nouvel étudiant
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
            placeholder="Rechercher par nom, prénom ou matricule…"
          />
        }
        actifs={filtresActifs}
        mobileOpen={filtresOuverts}
        onToggleMobile={() => setFiltresOuverts((open) => !open)}
        onReset={() => {
          setSexe('')
          setBac('')
          setPage(1)
        }}
      >
        <SelectFilter
          label="Sexe"
          value={sexe}
          onChange={(value) => {
            setSexe(value)
            setPage(1)
          }}
          allLabel="Tous"
          options={[
            { value: 'M', label: 'Masculin' },
            { value: 'F', label: 'Féminin' },
          ]}
        />
        <SelectFilter
          label="Baccalauréat"
          value={bac}
          onChange={(value) => {
            setBac(value)
            setPage(1)
          }}
          allLabel="Indifférent"
          options={[
            { value: 'true', label: 'Bachelier' },
            { value: 'false', label: 'Non bachelier' },
          ]}
        />
      </FilterBar>

      <DataTable
        columns={colonnes}
        rows={rows}
        rowKey={(etudiant) => etudiant.id}
        caption="Liste des étudiants"
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle="Aucun étudiant"
        emptyDescription={
          recherche || filtresActifs > 0
            ? 'Aucun résultat pour ces critères.'
            : 'Enregistrez un premier étudiant pour créer une inscription.'
        }
        emptyAction={
          ecriture ? (
            <Button variant="secondary" onClick={() => setDialogueOuvert(true)}>
              Nouvel étudiant
            </Button>
          ) : undefined
        }
        footer={<Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />}
      />

      <Dialog
        open={dialogueOuvert}
        onClose={() => setDialogueOuvert(false)}
        title="Nouvel étudiant"
        description="Le matricule sera généré à l’enregistrement (ex. ESSIG-FCVJD12)."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogueOuvert(false)}>
              Annuler
            </Button>
            <Button onClick={() => void soumettre()} loading={creation.isPending}>
              Enregistrer
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

        <div className="space-y-6">
          <FormSection title="Identité">
            <FormGrid>
              <InputField
                label="Nom"
                required
                value={valeurs.nom}
                error={erreurs.nom?.join(' ')}
                onChange={(event) => changer('nom', event.target.value)}
                autoComplete="family-name"
              />
              <InputField
                label="Prénoms"
                required
                value={valeurs.prenoms}
                error={erreurs.prenoms?.join(' ')}
                onChange={(event) => changer('prenoms', event.target.value)}
                autoComplete="given-name"
              />
              <SelectField
                label="Sexe"
                required
                value={valeurs.sexe}
                onChange={(event) => changer('sexe', event.target.value)}
                options={[
                  { value: 'M', label: 'Masculin' },
                  { value: 'F', label: 'Féminin' },
                ]}
              />
              <SelectField
                label="Situation matrimoniale"
                value={valeurs.situation_matrimoniale}
                onChange={(event) => changer('situation_matrimoniale', event.target.value)}
                placeholder="Non renseignée"
                options={[
                  { value: 'CELIBATAIRE', label: 'Célibataire' },
                  { value: 'MARIE', label: 'Marié(e)' },
                  { value: 'AUTRE', label: 'Autre' },
                ]}
              />
              <InputField
                label="Date de naissance"
                type="date"
                value={valeurs.date_naissance}
                onChange={(event) => changer('date_naissance', event.target.value)}
              />
              <InputField
                label="Lieu de naissance"
                value={valeurs.lieu_naissance}
                onChange={(event) => changer('lieu_naissance', event.target.value)}
              />
              <InputField
                label="Nationalité"
                value={valeurs.nationalite}
                onChange={(event) => changer('nationalite', event.target.value)}
              />
              <SelectField
                label="École (préfixe du matricule)"
                required
                value={valeurs.ecole_sigle}
                error={erreurs.ecole_sigle?.join(' ')}
                onChange={(event) => changer('ecole_sigle', event.target.value)}
                placeholder="— Sélectionner —"
                options={(ecoles.data ?? [])
                  .filter((ecole) => Boolean(ecole.sigle))
                  .map((ecole) => ({ value: ecole.sigle as string, label: `${ecole.sigle} — ${ecole.nom}` }))}
              />
            </FormGrid>
          </FormSection>

          <FormSection title="Coordonnées">
            <FormGrid>
              <InputField
                label="Téléphone"
                type="tel"
                inputMode="tel"
                value={valeurs.telephone}
                onChange={(event) => changer('telephone', event.target.value)}
                autoComplete="tel"
              />
              <InputField
                label="E-mail"
                type="email"
                value={valeurs.email}
                onChange={(event) => changer('email', event.target.value)}
                autoComplete="email"
              />
              <TextareaField
                label="Adresse"
                value={valeurs.adresse}
                onChange={(event) => changer('adresse', event.target.value)}
                containerClassName="md:col-span-2"
              />
            </FormGrid>
          </FormSection>

          <div className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--muted-foreground)]">
            <UserRound className="size-4 shrink-0" aria-hidden />
            Les affiliations (père, mère, tuteur) et la situation BAC se complètent depuis la
            fiche de l’étudiant après création.
          </div>
        </div>
      </Dialog>
    </>
  )
}
