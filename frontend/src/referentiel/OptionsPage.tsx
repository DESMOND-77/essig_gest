import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import type { OptionFiliere } from '@/lib/types'
import { optionFiliere, R, useFilieres, versOptions } from './hooks'

export function OptionsPage() {
  const { user } = useAuth()
  const filieres = useFilieres()

  const champs: FormulaireChamp[] = [
    {
      name: 'filiere',
      label: 'Filière',
      type: 'select',
      required: true,
      options: versOptions(filieres.data, optionFiliere),
    },
    { name: 'sigle', label: 'Sigle', required: true },
    { name: 'nom', label: 'Nom de l’option', required: true, colSpan: 2 },
  ]

  return (
    <ResourcePage<OptionFiliere>
      resource={R.options}
      titre="Options de filière"
      description="Spécialisations rattachées aux filières. Les classes et matières ciblent une option."
      singulier="option"
      peutEcrire={peutEcrire(user, 'referentiel')}
      columns={[
        {
          key: 'sigle',
          header: 'Option',
          primary: true,
          sortable: true,
          render: (option) => <span className="font-semibold">{option.sigle || option.nom}</span>,
        },
        { key: 'nom', header: 'Nom', render: (option) => option.nom },
        {
          key: 'filiere',
          header: 'Filière',
          hideBelow: 'sm',
          render: (option) => option.filiere_libelle,
        },
      ]}
      champs={champs}
      filtres={[
        { name: 'filiere', label: 'Filière', options: versOptions(filieres.data, optionFiliere) },
      ]}
      searchPlaceholder="Rechercher une option…"
    />
  )
}
