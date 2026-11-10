import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { DataTable, Pagination, type Column } from '@/components/data/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '@/components/data/Toolbar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import {
  CheckboxField,
  FormGrid,
  InputField,
  SelectField,
  TextareaField,
  type SelectOption,
} from '@/components/ui/FormField'
import { PageHeader } from '@/components/layout/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useCreate, useDebounced, usePagedList, useRemove, useUpdate } from '@/lib/hooks'
import { ApiError } from '@/lib/http'

export interface FormulaireChamp {
  name: string
  label: string
  type?: 'text' | 'number' | 'date' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox'
  required?: boolean
  hint?: string
  placeholder?: string
  options?: SelectOption[]
  colSpan?: 1 | 2
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  /** Valeur envoyée quand le champ est vide (défaut : null). */
  emptyValue?: unknown
}

export interface FiltreConfig {
  name: string
  label: string
  options: SelectOption[]
  allLabel?: string
}

interface ResourcePageProps<T> {
  resource: string
  titre: string
  description?: ReactNode
  singulier: string
  pluriel?: string
  columns: Column<T>[]
  champs: FormulaireChamp[]
  filtres?: FiltreConfig[]
  peutEcrire: boolean
  peutSupprimer?: boolean
  searchPlaceholder?: string
  emptyDescription?: string
  defaults?: Record<string, unknown>
  toFormValues?: (row: T) => Record<string, unknown>
  toPayload?: (values: Record<string, unknown>) => Record<string, unknown>
  actionsSupplementaires?: ReactNode
  detailPath?: (row: T) => string
  rowActions?: (row: T) => ReactNode
  extraToolbar?: ReactNode
  formTitleNew?: string
  formTitleEdit?: string
  pageSize?: number
  /** Masque l'en-tête de page (le parent porte déjà le titre). */
  sansEntete?: boolean
  /** Faux si le backend n'expose pas `?search=` sur cette ressource. */
  recherche?: boolean
}

type Valeurs = Record<string, unknown>

export function ResourcePage<T>({
  resource,
  titre,
  description,
  singulier,
  pluriel = `${singulier}s`,
  columns,
  champs,
  filtres = [],
  peutEcrire,
  peutSupprimer = true,
  searchPlaceholder,
  emptyDescription,
  defaults,
  toFormValues,
  toPayload,
  actionsSupplementaires,
  detailPath,
  rowActions,
  extraToolbar,
  formTitleNew,
  formTitleEdit,
  pageSize = 25,
  sansEntete = false,
  recherche: rechercheActive = true,
}: ResourcePageProps<T>) {
  const toast = useToast()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const rechercheDebounced = useDebounced(recherche, 350)
  const [filtresActifs, setFiltresActifs] = useState<Record<string, string>>({})
  const [filtresOuverts, setFiltresOuverts] = useState(false)
  const [ordonnancement, setOrdonnancement] = useState('')
  const [dialogue, setDialogue] = useState<{ mode: 'creation' | 'edition'; row?: T } | null>(null)
  const [aSupprimer, setASupprimer] = useState<T | null>(null)
  const [valeurs, setValeurs] = useState<Valeurs>({})
  const [erreursChamps, setErreursChamps] = useState<Record<string, string[]>>({})
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null)

  const params = useMemo(
    () => ({
      page,
      ...(rechercheDebounced ? { search: rechercheDebounced } : {}),
      ...(ordonnancement ? { ordering: ordonnancement } : {}),
      ...Object.fromEntries(Object.entries(filtresActifs).filter(([, value]) => value !== '')),
    }),
    [page, rechercheDebounced, ordonnancement, filtresActifs],
  )

  const query = usePagedList<T>(resource, params)
  const creation = useCreate<T>(resource)
  const miseAJour = useUpdate<T>(resource)
  const suppression = useRemove(resource)
  const rows = query.data?.results ?? []
  const total = query.data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const filtresActifsCount = Object.values(filtresActifs).filter(Boolean).length

  const valeursInitiales = (row?: T): Valeurs => {
    if (row && toFormValues) return toFormValues(row)
    if (row) return row as unknown as Valeurs
    return { ...(defaults ?? {}) }
  }

  const ouvrirCreation = () => {
    setErreursChamps({})
    setErreurGlobale(null)
    setValeurs(valeursInitiales())
    setDialogue({ mode: 'creation' })
  }

  const ouvrirEdition = (row: T) => {
    setErreursChamps({})
    setErreurGlobale(null)
    setValeurs(valeursInitiales(row))
    setDialogue({ mode: 'edition', row })
  }

  const construirePayload = (): Valeurs => {
    const payload: Valeurs = {}
    if (toPayload) return toPayload(valeurs)
    for (const champ of champs) {
      const valeur = valeurs[champ.name]
      if (champ.type === 'checkbox') {
        payload[champ.name] = Boolean(valeur)
        continue
      }
      if (valeur === '' || valeur === undefined || valeur === null) {
        if (champ.required) payload[champ.name] = valeur
        else if (champ.emptyValue !== undefined) payload[champ.name] = champ.emptyValue
        else payload[champ.name] = null
        continue
      }
      payload[champ.name] = champ.type === 'number' ? Number(valeur) : valeur
    }
    return payload
  }

  const soumettre = async () => {
    const manquants: Record<string, string[]> = {}
    for (const champ of champs) {
      const valeur = valeurs[champ.name]
      if (champ.required && (valeur === '' || valeur === null || valeur === undefined)) {
        manquants[champ.name] = ['Ce champ est obligatoire.']
      }
    }
    if (Object.keys(manquants).length > 0) {
      setErreursChamps(manquants)
      setErreurGlobale('Veuillez compléter les champs obligatoires.')
      return
    }

    try {
      const payload = construirePayload()
      if (dialogue?.mode === 'edition' && dialogue.row) {
        await miseAJour.mutateAsync({
          id: (dialogue.row as unknown as { id: number }).id,
          body: payload,
        })
        toast.succes(`${singulier} mis à jour`)
      } else {
        await creation.mutateAsync(payload)
        toast.succes(`${singulier} créé`)
      }
      setDialogue(null)
    } catch (error) {
      if (error instanceof ApiError) {
        setErreursChamps(error.fields ?? {})
        setErreurGlobale(error.status === 400 ? 'Vérifiez les champs du formulaire.' : error.message)
      } else {
        setErreurGlobale((error as Error).message)
      }
    }
  }

  const confirmerSuppression = async () => {
    if (!aSupprimer) return
    try {
      await suppression.mutateAsync((aSupprimer as unknown as { id: number }).id)
      toast.succes(`${singulier} supprimé`)
      setASupprimer(null)
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 409
          ? 'Suppression bloquée : cet élément est référencé par d’autres données.'
          : (error as Error).message
      toast.erreur('Suppression impossible', message)
      setASupprimer(null)
    }
  }

  const colonnes: Column<T>[] = [
    ...columns,
    ...(peutEcrire || rowActions
      ? [
          {
            key: '__actions',
            header: 'Actions',
            align: 'right' as const,
            render: (row: T) => (
              <div className="flex items-center justify-end gap-1">
                {rowActions?.(row)}
                {peutEcrire ? (
                  <>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        ouvrirEdition(row)
                      }}
                      aria-label={`Modifier ${singulier}`}
                      title="Modifier"
                      className="grid size-9 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--brand-primary-subtle)] hover:text-brand-700"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    {peutSupprimer ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setASupprimer(row)
                        }}
                        aria-label={`Supprimer ${singulier}`}
                        title="Supprimer"
                        className="grid size-9 place-items-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--destructive-subtle)] hover:text-[var(--destructive)]"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      {sansEntete ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
          {peutEcrire ? (
            <Button
              size="sm"
              onClick={ouvrirCreation}
              icon={<Plus className="size-4" aria-hidden />}
            >
              Nouveau
            </Button>
          ) : null}
        </div>
      ) : (
        <PageHeader
          title={titre}
          description={description}
          actions={
            <>
              {actionsSupplementaires}
              {peutEcrire ? (
                <Button onClick={ouvrirCreation} icon={<Plus className="size-4" aria-hidden />}>
                  Nouveau
                </Button>
              ) : null}
            </>
          }
        />
      )}

      <FilterBar
        search={
          rechercheActive ? (
            <SearchInput
              value={recherche}
              onChange={(value) => {
                setRecherche(value)
                setPage(1)
              }}
              placeholder={searchPlaceholder ?? `Rechercher un ${singulier}…`}
            />
          ) : undefined
        }
        actifs={filtresActifsCount}
        mobileOpen={filtresOuverts}
        onToggleMobile={() => setFiltresOuverts((open) => !open)}
        onReset={() => {
          setFiltresActifs({})
          setPage(1)
        }}
      >
        {filtres.map((filtre) => (
          <SelectFilter
            key={filtre.name}
            label={filtre.label}
            value={filtresActifs[filtre.name] ?? ''}
            allLabel={filtre.allLabel ?? 'Tous'}
            options={filtre.options}
            onChange={(value) => {
              setFiltresActifs((current) => ({ ...current, [filtre.name]: value }))
              setPage(1)
            }}
          />
        ))}
        {extraToolbar}
      </FilterBar>

      <DataTable
        columns={colonnes}
        rows={rows}
        rowKey={(row) => (row as { id: number }).id}
        caption={`Liste des ${pluriel}`}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={`Aucun ${singulier}`}
        emptyDescription={
          emptyDescription ??
          (recherche || filtresActifsCount > 0
            ? 'Aucun résultat pour ces critères. Modifiez la recherche ou les filtres.'
            : `Créez votre premier ${singulier} pour commencer.`)
        }
        onRowClick={detailPath ? (row) => navigate(detailPath(row)) : undefined}
        mobileCards
        sort={
          ordonnancement
            ? {
                field: ordonnancement.replace(/^-/, ''),
                direction: ordonnancement.startsWith('-') ? 'desc' : 'asc',
              }
            : undefined
        }
        onSortChange={(field) => {
          setOrdonnancement((current) =>
            current === field ? `-${field}` : current === `-${field}` ? '' : field,
          )
        }}
        footer={<Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />}
      />

      <Dialog
        open={dialogue !== null}
        onClose={() => setDialogue(null)}
        title={
          dialogue?.mode === 'edition'
            ? (formTitleEdit ?? `Modifier ${singulier}`)
            : (formTitleNew ?? `Nouveau ${singulier}`)
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogue(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => void soumettre()}
              loading={creation.isPending || miseAJour.isPending}
            >
              {dialogue?.mode === 'edition' ? 'Enregistrer' : 'Créer'}
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
          {champs.map((champ) => {
            const erreur = erreursChamps[champ.name]?.join(' ')
            const valeur = valeurs[champ.name]
            const commun = {
              name: champ.name,
              label: champ.label,
              required: champ.required,
              hint: champ.hint,
              error: erreur,
              disabled: champ.disabled,
              containerClassName: champ.colSpan === 2 ? 'md:col-span-2' : undefined,
            }
            if (champ.type === 'checkbox') {
              return (
                <CheckboxField
                  key={champ.name}
                  label={champ.label}
                  hint={champ.hint}
                  checked={Boolean(valeur)}
                  onChange={(event) =>
                    setValeurs((current) => ({ ...current, [champ.name]: event.target.checked }))
                  }
                />
              )
            }
            if (champ.type === 'select') {
              return (
                <SelectField
                  key={champ.name}
                  {...commun}
                  options={champ.options ?? []}
                  placeholder="— Sélectionner —"
                  value={valeur === null || valeur === undefined ? '' : String(valeur)}
                  onChange={(event) =>
                    setValeurs((current) => ({ ...current, [champ.name]: event.target.value }))
                  }
                />
              )
            }
            if (champ.type === 'textarea') {
              return (
                <TextareaField
                  key={champ.name}
                  {...commun}
                  placeholder={champ.placeholder}
                  value={(valeur as string) ?? ''}
                  onChange={(event) =>
                    setValeurs((current) => ({ ...current, [champ.name]: event.target.value }))
                  }
                />
              )
            }
            return (
              <InputField
                key={champ.name}
                {...commun}
                type={champ.type ?? 'text'}
                placeholder={champ.placeholder}
                min={champ.min}
                max={champ.max}
                step={champ.step}
                inputMode={champ.type === 'number' ? 'numeric' : undefined}
                value={(valeur as string | number) ?? ''}
                onChange={(event) =>
                  setValeurs((current) => ({ ...current, [champ.name]: event.target.value }))
                }
              />
            )
          })}
        </FormGrid>
      </Dialog>

      <ConfirmDialog
        open={aSupprimer !== null}
        onClose={() => setASupprimer(null)}
        onConfirm={() => void confirmerSuppression()}
        title={`Supprimer ce ${singulier} ?`}
        message={
          <>
            Cette action est définitive. Si l’élément est référencé par d’autres données
            (inscriptions, notes, mouvements…), le serveur refusera la suppression.
          </>
        }
        confirmLabel="Supprimer"
        danger
        loading={suppression.isPending}
      />
    </>
  )
}

/** Lien « fiche » standard utilisé dans les colonnes de tableau. */
export function LienFiche({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="font-semibold text-brand-700 underline-offset-2 hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </Link>
  )
}
