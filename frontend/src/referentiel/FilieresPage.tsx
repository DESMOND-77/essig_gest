import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import type { Filiere } from '@/lib/types'
import { optionEcole, R, useEcoles, versOptions } from './hooks'

export function FilieresPage() {
  const { user } = useAuth()
  const ecoles = useEcoles()

  const champs: FormulaireChamp[] = [
    {
      name: 'ecole',
      label: 'École',
      type: 'select',
      required: true,
      options: versOptions(ecoles.data, optionEcole),
    },
    { name: 'sigle', label: 'Sigle', required: true },
    { name: 'nom', label: 'Nom de la filière', required: true, colSpan: 2 },
  ]

  return (
    <ResourcePage<Filiere>
      resource={R.filieres}
      titre="Filières"
      description="Filières proposées par chaque école, et leurs options."
      singulier="filière"
      peutEcrire={peutEcrire(user, 'referentiel')}
      columns={[
        {
          key: 'sigle',
          header: 'Sigle',
          primary: true,
          sortable: true,
          render: (filiere) => <span className="font-semibold">{filiere.sigle}</span>,
        },
        { key: 'nom', header: 'Nom', render: (filiere) => filiere.nom },
        { key: 'ecole', header: 'École', hideBelow: 'sm', render: (filiere) => filiere.ecole_libelle },
      ]}
      champs={champs}
      filtres={[
        { name: 'ecole', label: 'École', options: versOptions(ecoles.data, optionEcole) },
      ]}
      searchPlaceholder="Rechercher une filière…"
    />
  )
}
