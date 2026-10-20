import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { dateCourte } from '@/lib/format'
import type { AnneeScolaire } from '@/lib/types'
import { R } from './hooks'

const champs: FormulaireChamp[] = [
  {
    name: 'libelle',
    label: 'Libellé',
    required: true,
    placeholder: '2025-2026',
    hint: 'Format AAAA-AAAA.',
  },
  { name: 'est_courante', label: 'Année en cours', type: 'checkbox', hint: 'Une seule année peut être courante : la bascule est automatique.' },
  { name: 'date_debut', label: 'Date de début', type: 'date', required: true },
  { name: 'date_fin', label: 'Date de fin', type: 'date', required: true },
]

export function AnneesPage() {
  const { user } = useAuth()

  return (
    <ResourcePage<AnneeScolaire>
      resource={R.annees}
      titre="Années scolaires"
      description="Chaque inscription, échéancier et salaire est rattaché à une année scolaire."
      singulier="année scolaire"
      pluriel="années scolaires"
      peutEcrire={peutEcrire(user, 'referentiel')}
      columns={[
        {
          key: 'libelle',
          header: 'Année',
          primary: true,
          sortable: true,
          render: (annee) => (
            <span className="flex items-center gap-2 font-semibold">
              {annee.libelle}
              {annee.est_courante ? <Badge tone="success">En cours</Badge> : null}
            </span>
          ),
        },
        {
          key: 'date_debut',
          header: 'Début',
          hideBelow: 'sm',
          render: (annee) => dateCourte(annee.date_debut),
        },
        { key: 'date_fin', header: 'Fin', render: (annee) => dateCourte(annee.date_fin) },
      ]}
      champs={champs}
      searchPlaceholder="Rechercher une année…"
      emptyDescription="Créez l’année scolaire en cours avant de saisir les inscriptions."
    />
  )
}
