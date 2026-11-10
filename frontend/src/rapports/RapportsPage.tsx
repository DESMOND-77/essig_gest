import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Landmark,
  Receipt,
  ScrollText,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import type { ComponentType } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { FormGrid, InputField, SelectField } from '@/components/ui/FormField'
import { DataTable, type Column } from '@/components/data/DataTable'
import { InfoBanner } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { fcfa } from '@/lib/format'
import { api, openDocument } from '@/lib/http'
import type { TableauDeBord } from '@/lib/types'
import {
  optionAnnee,
  optionEcole,
  optionNiveau,
  optionPeriode,
  useAnnees,
  useEcoles,
  useNiveaux,
  usePeriodes,
  versOptions,
} from '@/referentiel/hooks'

type CleRapport =
  | 'situation-scolarite'
  | 'situation-frais'
  | 'echeancier'
  | 'etat-scolarite-etudiant'
  | 'solde-compte'
  | 'bilan-mensuel'
  | 'bilan-consolide'
  | 'masse-salariale'
  | 'paie-enseignant'
  | 'resultat-matiere'
  | 'bulletin-periode'
  | 'resultat-annuel'
  | 'arrete-caisse'

interface Definition {
  cle: CleRapport
  titre: string
  description: string
  icone: ComponentType<{ className?: string }>
  pdf?: string
  champs: ('annee_scolaire' | 'ecole' | 'mois' | 'periode' | 'niveau' | 'inscription' | 'compte')[]
}

const DEFINITIONS: Definition[] = [
  {
    cle: 'situation-scolarite',
    titre: 'Situation de scolarité',
    description: 'Coût dû, part étudiante, encaissé et reste à payer par inscription.',
    icone: Users,
    pdf: 'situation-scolarite/pdf/',
    champs: ['annee_scolaire', 'ecole'],
  },
  {
    cle: 'etat-scolarite-etudiant',
    titre: 'État de scolarité par étudiant',
    description: 'Détail par étudiant : scolarité, frais annexes et reste total.',
    icone: FileText,
    champs: ['annee_scolaire', 'inscription'],
  },
  {
    cle: 'echeancier',
    titre: 'Échéancier',
    description: 'Toutes les échéances avec montant réglé, reste et retard.',
    icone: ScrollText,
    champs: ['annee_scolaire', 'ecole'],
  },
  {
    cle: 'situation-frais',
    titre: 'Situation des frais annexes',
    description: 'Frais par type : montants dus, exonérations et encaissements.',
    icone: Receipt,
    champs: ['annee_scolaire', 'ecole'],
  },
  {
    cle: 'solde-compte',
    titre: 'Soldes des comptes',
    description: 'Solde calculé de chaque compte de trésorerie.',
    icone: Landmark,
    champs: ['compte'],
  },
  {
    cle: 'bilan-mensuel',
    titre: 'Bilan mensuel',
    description: 'Entrées, dépenses et solde par mois.',
    icone: BarChart3,
    champs: ['annee_scolaire', 'ecole'],
  },
  {
    cle: 'bilan-consolide',
    titre: 'Bilan consolidé',
    description: 'Synthèse financière toutes écoles pour une année.',
    icone: FileSpreadsheet,
    pdf: 'etat-financier/pdf/',
    champs: ['annee_scolaire'],
  },
  {
    cle: 'masse-salariale',
    titre: 'Masse salariale',
    description: 'Salaires enseignants et administratifs par mois.',
    icone: FileSpreadsheet,
    champs: ['annee_scolaire', 'mois'],
  },
  {
    cle: 'paie-enseignant',
    titre: 'Paie par enseignant',
    description: 'Montant dû et payé pour chaque enseignant.',
    icone: FileSpreadsheet,
    champs: ['annee_scolaire'],
  },
  {
    cle: 'resultat-matiere',
    titre: 'Résultats par matière',
    description: 'Moyennes, crédits et validation par matière.',
    icone: FileSpreadsheet,
    champs: ['annee_scolaire', 'periode', 'niveau'],
  },
  {
    cle: 'bulletin-periode',
    titre: 'Bulletins de période',
    description: 'Moyennes de période par inscription.',
    icone: FileSpreadsheet,
    champs: ['annee_scolaire', 'periode'],
  },
  {
    cle: 'resultat-annuel',
    titre: 'Résultats annuels',
    description: 'Décisions et mentions de fin d’année.',
    icone: FileSpreadsheet,
    champs: ['annee_scolaire'],
  },
  {
    cle: 'arrete-caisse',
    titre: 'Arrêté de caisse',
    description: 'Détail d’un arrêté : solde théorique, physique et billetage.',
    icone: Landmark,
    champs: ['compte'],
  },
]

function nettoyer(parametres: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(parametres).filter(([, valeur]) => valeur !== ''))
}

export function RapportsPage() {
  const toast = useToast()
  const annees = useAnnees()
  const ecoles = useEcoles()
  const periodes = usePeriodes()
  const niveaux = useNiveaux()

  const [rapport, setRapport] = useState<Definition | null>(null)
  const [parametres, setParametres] = useState<Record<string, string>>({})
  const [resultat, setResultat] = useState<unknown[] | null>(null)
  const [tableau, setTableau] = useState<TableauDeBord | null>(null)
  const [chargement, setChargement] = useState(false)

  const ouvrir = (definition: Definition) => {
    const anneeCourante = annees.data?.find((annee) => annee.est_courante)
    setRapport(definition)
    setResultat(null)
    setTableau(null)
    setParametres({
      ...(definition.champs.includes('annee_scolaire') && anneeCourante
        ? { annee_scolaire: String(anneeCourante.id) }
        : {}),
    })
  }

  const charger = async () => {
    if (!rapport) return
    setChargement(true)
    try {
      if (rapport.cle === 'bilan-consolide') {
        const tableauDeBord = await api.get<TableauDeBord>('/api/v1/rapports/tableau-de-bord/')
        setTableau(tableauDeBord)
        setResultat([])
      } else {
        const donnees = await api.get<unknown>(`/api/v1/rapports/${rapport.cle}/`, {
          params: nettoyer(parametres),
        })
        setResultat(Array.isArray(donnees) ? donnees : [donnees])
        setTableau(null)
      }
    } catch (error) {
      toast.erreur('Rapport indisponible', (error as Error).message)
    } finally {
      setChargement(false)
    }
  }

  const telecharger = async () => {
    if (!rapport?.pdf) return
    try {
      await openDocument(`/api/v1/rapports/${rapport.pdf}`, nettoyer(parametres))
    } catch (error) {
      toast.erreur('Téléchargement impossible', (error as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        title="Rapports & états"
        description="États de scolarité, finances, paie et résultats. Chaque rapport peut être exporté en PDF par le serveur."
        badge={<Badge tone="neutral">Exports PDF signés</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DEFINITIONS.map((definition) => (
          <Card key={definition.cle} className="flex flex-col">
            <div className="flex items-start gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-primary-subtle)] text-brand-700">
                <definition.icone className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold">{definition.titre}</h2>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{definition.description}</p>
              </div>
            </div>
            <div className="mt-auto flex items-center gap-2 border-t border-[var(--border)] p-3">
              <Button size="sm" variant="secondary" onClick={() => ouvrir(definition)}>
                Paramétrer
              </Button>
              {definition.pdf ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await openDocument(`/api/v1/rapports/${definition.pdf}`)
                    } catch (error) {
                      toast.erreur('Export impossible', (error as Error).message)
                    }
                  }}
                >
                  PDF
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={rapport !== null}
        onClose={() => setRapport(null)}
        title={rapport?.titre ?? 'Rapport'}
        description="Renseignez les paramètres puis générez l’état."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setRapport(null)}>
              Fermer
            </Button>
            {rapport?.pdf ? (
              <Button variant="secondary" onClick={() => void telecharger()}>
                Télécharger le PDF
              </Button>
            ) : null}
            <Button onClick={() => void charger()} loading={chargement}>
              Générer
            </Button>
          </>
        }
      >
        {rapport ? (
          <div className="space-y-4">
            <FormGrid>
              {rapport.champs.includes('annee_scolaire') ? (
                <SelectField
                  label="Année scolaire"
                  value={parametres.annee_scolaire ?? ''}
                  placeholder="Toutes"
                  options={versOptions(annees.data, optionAnnee)}
                  onChange={(event) =>
                    setParametres((current) => ({ ...current, annee_scolaire: event.target.value }))
                  }
                />
              ) : null}
              {rapport.champs.includes('ecole') ? (
                <SelectField
                  label="École"
                  value={parametres.ecole ?? ''}
                  placeholder="Toutes"
                  options={versOptions(ecoles.data, optionEcole)}
                  onChange={(event) =>
                    setParametres((current) => ({ ...current, ecole: event.target.value }))
                  }
                />
              ) : null}
              {rapport.champs.includes('periode') ? (
                <SelectField
                  label="Période"
                  value={parametres.periode ?? ''}
                  placeholder="Toutes"
                  options={versOptions(periodes.data, optionPeriode)}
                  onChange={(event) =>
                    setParametres((current) => ({ ...current, periode: event.target.value }))
                  }
                />
              ) : null}
              {rapport.champs.includes('niveau') ? (
                <SelectField
                  label="Niveau"
                  value={parametres.niveau ?? ''}
                  placeholder="Tous"
                  options={versOptions(niveaux.data, optionNiveau)}
                  onChange={(event) =>
                    setParametres((current) => ({ ...current, niveau: event.target.value }))
                  }
                />
              ) : null}
              {rapport.champs.includes('mois') ? (
                <SelectField
                  label="Mois"
                  value={parametres.mois ?? ''}
                  placeholder="Tous"
                  options={[
                    'SEPT',
                    'OCT',
                    'NOV',
                    'DEC',
                    'JAN',
                    'FEV',
                    'MAR',
                    'AVR',
                    'MAI',
                    'JUIN',
                    'JUIL',
                    'AOUT',
                  ].map((mois) => ({ value: mois, label: mois }))}
                  onChange={(event) =>
                    setParametres((current) => ({ ...current, mois: event.target.value }))
                  }
                />
              ) : null}
              {rapport.champs.includes('inscription') ? (
                <InputField
                  label="Identifiant d’inscription"
                  type="number"
                  min={1}
                  value={parametres.inscription ?? ''}
                  hint="Le numéro figure sur la fiche d’inscription."
                  onChange={(event) =>
                    setParametres((current) => ({ ...current, inscription: event.target.value }))
                  }
                />
              ) : null}
              {rapport.champs.includes('compte') ? (
                <InputField
                  label="Identifiant de compte"
                  type="number"
                  min={1}
                  value={parametres.compte ?? ''}
                  onChange={(event) =>
                    setParametres((current) => ({ ...current, compte: event.target.value }))
                  }
                />
              ) : null}
            </FormGrid>

            {tableau ? (
              <Card>
                <CardHeader title={`Synthèse — ${tableau.annee_scolaire_libelle ?? 'toutes années'}`} />
                <dl className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-[var(--muted-foreground)]">Encaissements</dt>
                    <dd className="numeric font-bold">{fcfa(tableau.encaissements)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted-foreground)]">Dépenses</dt>
                    <dd className="numeric font-bold">{fcfa(tableau.depenses)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted-foreground)]">Solde des comptes</dt>
                    <dd className="numeric font-bold">{fcfa(tableau.solde_comptes)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted-foreground)]">Reste à recouvrer</dt>
                    <dd className="numeric font-bold">{fcfa(tableau.reste_a_recouvrer)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted-foreground)]">Masse salariale</dt>
                    <dd className="numeric font-bold">{fcfa(tableau.masse_salariale)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted-foreground)]">Étudiants inscrits</dt>
                    <dd className="numeric font-bold">{tableau.etudiants_inscrits}</dd>
                  </div>
                </dl>
              </Card>
            ) : null}

            {resultat && resultat.length > 0 ? (
              <TableauRapport rapport={rapport.cle} lignes={resultat as Record<string, unknown>[]} />
            ) : resultat && resultat.length === 0 ? (
              <InfoBanner tone="info" title="Aucune donnée">
                Le rapport ne renvoie aucune ligne pour ces paramètres.
              </InfoBanner>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  )
}

function formaterValeur(cle: string, valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === '') return '—'
  if (typeof valeur === 'boolean') return valeur ? 'Oui' : 'Non'
  if (typeof valeur === 'number') {
    return /montant|solde|encaisse|reste|cout|prix|total|depense|masse|paie|du|paye/i.test(cle)
      ? fcfa(valeur)
      : new Intl.NumberFormat('fr-FR').format(valeur)
  }
  if (typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valeur)) {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(valeur))
  }
  if (typeof valeur === 'object') return JSON.stringify(valeur)
  return String(valeur)
}

function TableauRapport({
  rapport,
  lignes,
}: {
  rapport: CleRapport
  lignes: Record<string, unknown>[]
}) {
  void rapport
  const cles = Array.from(new Set(lignes.flatMap((ligne) => Object.keys(ligne)))).filter(
    (cle) => cle !== 'id',
  )

  const colonnes: Column<Record<string, unknown>>[] = cles.map((cle, index) => ({
    key: cle,
    header: cle.replaceAll('_', ' '),
    primary: index === 0,
    align: typeof lignes[0]?.[cle] === 'number' ? 'right' : 'left',
    render: (ligne) => (
      <span className={typeof ligne[cle] === 'number' ? 'numeric' : undefined}>
        {formaterValeur(cle, ligne[cle])}
      </span>
    ),
  }))

  return (
    <DataTable
      columns={colonnes}
      rows={lignes}
      rowKey={(ligne) => String(ligne.id ?? String(Object.values(ligne)[0]))}
      caption="Résultat du rapport"
      emptyTitle="Aucune ligne"
    />
  )
}
