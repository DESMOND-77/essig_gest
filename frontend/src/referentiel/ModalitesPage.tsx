import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import type { ModaliteFormation } from '@/lib/types'
import { R } from './hooks'

const champs: FormulaireChamp[] = [
  {
    name: 'code',
    label: 'Code',
    type: 'select',
    required: true,
    options: [
      { value: 'FI', label: 'FI — Formation initiale' },
      { value: 'FC', label: 'FC — Formation continue' },
      { value: 'FL', label: 'FL — Formation à distance' },
      { value: 'FT', label: 'FT — Formation en alternance' },
    ],
  },
  { name: 'libelle', label: 'Libellé', required: true, colSpan: 2 },
]

export function ModalitesPage() {
  const { user } = useAuth()
  return (
    <ResourcePage<ModaliteFormation>
      resource={R.modalites}
      titre="Modalités de formation"
      description="Formation initiale, continue, à distance ou en alternance."
      singulier="modalité"
      peutEcrire={peutEcrire(user, 'referentiel')}
      columns={[
        {
          key: 'code',
          header: 'Code',
          primary: true,
          render: (modalite) => <span className="font-semibold">{modalite.code}</span>,
        },
        { key: 'libelle', header: 'Libellé', render: (modalite) => modalite.libelle },
      ]}
      champs={champs}
      searchPlaceholder="Rechercher une modalité…"
    />
  )
}
