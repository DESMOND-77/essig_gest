import { CheckCircle2, Save, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, StatCard } from '@/components/ui/Card'
import { EmptyState, ErrorState, InfoBanner, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { decimal, nombre } from '@/lib/format'
import { api, ApiError } from '@/lib/http'
import { useAll, usePagedList } from '@/lib/hooks'
import type { Evaluation, Inscription, NoteEvaluation } from '@/lib/types'
import { optionClasse, useClasses, useMatieres } from '@/referentiel/hooks'

interface LigneNote {
  inscription: Inscription
  note: NoteEvaluation | null
  valeur: string
  absent: boolean
  enregistrement: 'idle' | 'loading' | 'saved' | 'error'
}

export function NotesPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'evaluations')
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const classes = useClasses()
  const matieres = useMatieres()
  const [classe, setClasse] = useState(searchParams.get('classe') ?? '')
  const [evaluationId, setEvaluationId] = useState<number | null>(
    searchParams.get('evaluation') ? Number(searchParams.get('evaluation')) : null,
  )
  const [lignes, setLignes] = useState<LigneNote[]>([])

  const evaluations = usePagedList<Evaluation>('evaluations/evaluations', {
    ...(classe ? { classe } : {}),
    page: 1,
  })
  const inscriptions = useAll<Inscription>('personnes/inscriptions', {
    ...(classe ? { classe, etat: 'ACTIVE' } : {}),
    ordering: 'etudiant__nom',
  })
  const notes = useAll<NoteEvaluation>('evaluations/notes', {
    ...(evaluationId ? { evaluation: evaluationId } : {}),
  })

  const evaluation = evaluations.data?.results.find((item) => item.id === evaluationId) ?? null

  const listeInscriptions = useMemo(() => inscriptions.data ?? [], [inscriptions.data])

  useEffect(() => {
    if (!evaluationId || inscriptions.isLoading || notes.isLoading) return
    const parInscription = new Map((notes.data ?? []).map((note) => [note.inscription, note]))
    setLignes(
      listeInscriptions.map((inscription) => {
        const note = parInscription.get(inscription.id) ?? null
        return {
          inscription,
          note,
          valeur: note?.valeur !== null && note?.valeur !== undefined ? String(Number(note.valeur)) : '',
          absent: note?.absent ?? false,
          enregistrement: 'idle',
        }
      }),
    )
  }, [evaluationId, inscriptions.isLoading, notes.isLoading, listeInscriptions, notes.data])

  const changerClasse = (valeur: string) => {
    setClasse(valeur)
    setEvaluationId(null)
    setSearchParams((params) => {
      if (valeur) params.set('classe', valeur)
      else params.delete('classe')
      params.delete('evaluation')
      return params
    })
  }

  const choisirEvaluation = (valeur: string) => {
    const id = valeur ? Number(valeur) : null
    setEvaluationId(id)
    setSearchParams((params) => {
      if (id) params.set('evaluation', String(id))
      else params.delete('evaluation')
      return params
    })
  }

  const majLigne = (inscriptionId: number, patch: Partial<LigneNote>) => {
    setLignes((current) =>
      current.map((ligne) =>
        ligne.inscription.id === inscriptionId ? { ...ligne, ...patch } : ligne,
      ),
    )
  }

  const enregistrer = async (ligne: LigneNote) => {
    if (!evaluationId || !evaluation) return
    const valeur = ligne.valeur === '' ? null : Number(ligne.valeur)
    if (!ligne.absent && valeur !== null) {
      if (valeur < 0 || valeur > evaluation.bareme) {
        toast.erreur(
          'Note hors barème',
          `La note doit être comprise entre 0 et ${evaluation.bareme}.`,
        )
        majLigne(ligne.inscription.id, { enregistrement: 'error' })
        return
      }
    }

    majLigne(ligne.inscription.id, { enregistrement: 'loading' })
    try {
      const body = {
        evaluation: evaluationId,
        inscription: ligne.inscription.id,
        valeur: ligne.absent ? null : valeur,
        absent: ligne.absent,
      }
      if (ligne.note) {
        await api.patch(`/api/v1/evaluations/notes/${ligne.note.id}/`, body)
      } else {
        await api.post('/api/v1/evaluations/notes/', body)
      }
      majLigne(ligne.inscription.id, { enregistrement: 'saved' })
      await notes.refetch()
      window.setTimeout(() => majLigne(ligne.inscription.id, { enregistrement: 'idle' }), 1500)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : (error as Error).message
      toast.erreur('Enregistrement impossible', message)
      majLigne(ligne.inscription.id, { enregistrement: 'error' })
    }
  }

  const enregistrerTout = async () => {
    for (const ligne of lignes) {
      if (ligne.valeur !== '' || ligne.absent) {
        await enregistrer(ligne)
      }
    }
    toast.succes('Notes enregistrées')
  }

  const notesSaisies = lignes.filter((ligne) => ligne.valeur !== '' || ligne.absent).length
  const moyenne =
    lignes.length === 0
      ? 0
      : lignes.reduce((sum, ligne) => {
          const valeur = ligne.absent ? 0 : Number(ligne.valeur || 0)
          return sum + valeur
        }, 0) / Math.max(1, notesSaisies)

  return (
    <>
      <PageHeader
        title="Saisie des notes"
        description="Choisissez une classe puis une évaluation. Les notes sont contrôlées contre le barème par le serveur."
        actions={
          ecriture && evaluation ? (
            <Button icon={<Save className="size-4" aria-hidden />} onClick={() => void enregistrerTout()}>
              Tout enregistrer
            </Button>
          ) : undefined
        }
      />

      <div className="surface-card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="field-label">Classe</span>
            <select
              value={classe}
              onChange={(event) => changerClasse(event.target.value)}
              className="control"
            >
              <option value="">— Sélectionner une classe —</option>
              {(classes.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {optionClasse(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label">Évaluation</span>
            <select
              value={evaluationId ?? ''}
              onChange={(event) => choisirEvaluation(event.target.value)}
              className="control"
              disabled={!classe}
            >
              <option value="">— Sélectionner une évaluation —</option>
              {(evaluations.data?.results ?? []).map((item) => {
                const matiere = matieres.data?.find((m) => m.id === item.matiere)
                return (
                  <option key={item.id} value={item.id}>
                    {matiere?.nom ?? `Matière #${item.matiere}`} · {item.type} · pondération{' '}
                    {nombre(Number(item.ponderation))} %
                  </option>
                )
              })}
            </select>
            {classe && evaluations.data?.results.length === 0 ? (
              <p className="field-hint">
                Aucune évaluation pour cette classe. Créez-en une dans « Évaluations ».
              </p>
            ) : null}
          </label>
        </div>
      </div>

      {!classe ? (
        <EmptyState
          icon={<Users className="size-6" aria-hidden />}
          title="Sélectionnez une classe"
          description="La saisie des notes s’effectue classe par classe, pour une évaluation donnée."
        />
      ) : !evaluationId ? (
        <EmptyState
          title="Sélectionnez une évaluation"
          description="Les étudiants inscrits dans la classe apparaîtront avec un champ de note."
        />
      ) : inscriptions.error ? (
        <ErrorState message={inscriptions.error.message} onRetry={() => void inscriptions.refetch()} />
      ) : inscriptions.isLoading || notes.isLoading ? (
        <LoadingState label="Chargement des étudiants de la classe…" />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Étudiants" value={lignes.length} />
            <StatCard label="Notes saisies" value={`${notesSaisies}/${lignes.length}`} tone="success" />
            <StatCard
              label="Moyenne provisoire"
              value={notesSaisies > 0 ? decimal(moyenne) : '—'}
              detail={evaluation ? `sur ${evaluation.bareme}` : undefined}
              tone="accent"
            />
          </div>

          <Card>
            <CardHeader
              title={evaluation ? `Évaluation — barème /${evaluation.bareme}` : 'Notes'}
              description="Saisissez une note, cochez « absent », puis enregistrez la ligne."
            />
            <div className="divide-y divide-[var(--border)]">
              {lignes.length === 0 ? (
                <EmptyState
                  title="Aucun étudiant inscrit"
                  description="Aucune inscription active dans cette classe."
                />
              ) : (
                lignes.map((ligne) => (
                  <div
                    key={ligne.inscription.id}
                    className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--foreground)]">
                        {ligne.inscription.etudiant_libelle}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        N° ordre {ligne.inscription.numero_ordre}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`note-${ligne.inscription.id}`}>
                        Note de {ligne.inscription.etudiant_libelle}
                      </label>
                      <input
                        id={`note-${ligne.inscription.id}`}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        max={evaluation?.bareme ?? 20}
                        value={ligne.valeur}
                        disabled={ligne.absent || !ecriture}
                        onChange={(event) =>
                          majLigne(ligne.inscription.id, {
                            valeur: event.target.value,
                            enregistrement: 'idle',
                          })
                        }
                        aria-invalid={ligne.enregistrement === 'error'}
                        className="control w-24 text-center"
                        placeholder="—"
                      />
                      <label className="inline-flex min-h-10 items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                        <input
                          type="checkbox"
                          checked={ligne.absent}
                          disabled={!ecriture}
                          onChange={(event) =>
                            majLigne(ligne.inscription.id, {
                              absent: event.target.checked,
                              valeur: event.target.checked ? '' : ligne.valeur,
                              enregistrement: 'idle',
                            })
                          }
                          className="size-4 accent-[var(--brand-primary)]"
                        />
                        Absent
                      </label>

                      {ecriture ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={ligne.enregistrement === 'loading'}
                          onClick={() => void enregistrer(ligne)}
                        >
                          {ligne.enregistrement === 'saved' ? (
                            <CheckCircle2 className="size-4" aria-hidden />
                          ) : (
                            'Enregistrer'
                          )}
                        </Button>
                      ) : (
                        <Badge tone="neutral">Lecture</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <div className="mt-4">
            <InfoBanner tone="info" title="Contrôle serveur">
              Une note hors barème est refusée. Un étudiant marqué absent est enregistré sans note,
              jamais avec un zéro implicite.
            </InfoBanner>
          </div>
        </>
      )}
    </>
  )
}
