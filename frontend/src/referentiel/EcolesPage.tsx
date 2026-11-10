import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import type { Ecole } from '@/lib/types'
import { R } from './hooks'

const champs: FormulaireChamp[] = [
  { name: 'nom', label: 'Nom de l’école', required: true, colSpan: 2 },
  { name: 'sigle', label: 'Sigle', hint: 'Utilisé dans les matricules (ex. ESSIG).' },
  {
    name: 'regime',
    label: 'Régime',
    type: 'select',
    required: true,
    options: [
      { value: 'LMD', label: 'LMD' },
      { value: 'CLASSIQUE', label: 'Classique' },
    ],
  },
  { name: 'contacts', label: 'Contacts téléphoniques' },
  { name: 'email', label: 'Adresse e-mail', type: 'email' },
  { name: 'adresse', label: 'Adresse', colSpan: 2 },
]

export function EcolesPage() {
  const { user } = useAuth()

  return (
    <ResourcePage<Ecole>
      resource={R.ecoles}
      titre="Écoles"
      description="Les écoles du groupe. Chaque niveau, filière et classe est rattaché à une école."
      singulier="école"
      pluriel="écoles"
      peutEcrire={peutEcrire(user, 'referentiel')}
      searchPlaceholder="Rechercher une école…"
      filtres={[
        {
          name: 'regime',
          label: 'Régime',
          options: [
            { value: 'LMD', label: 'LMD' },
            { value: 'CLASSIQUE', label: 'Classique' },
          ],
        },
      ]}
      columns={[
        {
          key: 'nom',
          header: 'École',
          primary: true,
          sortable: true,
          render: (ecole) => (
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[var(--foreground)]">{ecole.nom}</span>
              {ecole.sigle ? <Badge tone="brand">{ecole.sigle}</Badge> : null}
            </span>
          ),
        },
        {
          key: 'regime',
          header: 'Régime',
          render: (ecole) => (
            <Badge tone={ecole.regime === 'LMD' ? 'brand' : 'accent'}>
              {ecole.regime === 'LMD' ? 'LMD' : 'Classique'}
            </Badge>
          ),
        },
        { key: 'contacts', header: 'Contacts', hideBelow: 'md', render: (ecole) => ecole.contacts ?? '—' },
        { key: 'email', header: 'E-mail', hideBelow: 'lg', render: (ecole) => ecole.email ?? '—' },
        {
          key: 'adresse',
          header: 'Adresse',
          hideBelow: 'xl',
          render: (ecole) => (
            <span className="line-clamp-1 max-w-64 text-[var(--muted-foreground)]">
              {ecole.adresse ?? '—'}
            </span>
          ),
        },
      ]}
      champs={champs}
      emptyDescription="Créez une école pour y rattacher les niveaux, filières et classes."
    />
  )
}
