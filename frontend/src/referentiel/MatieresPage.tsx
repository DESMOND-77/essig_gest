import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { nombre } from '@/lib/format'
import type { Matiere } from '@/lib/types'
import {
  optionNiveau,
  optionOption,
  R,
  useNiveaux,
  useOptionsFiliere,
  versOptions,
} from './hooks'

export function MatieresPage() {
  const { user } = useAuth()
  const niveaux = useNiveaux()
  const options = useOptionsFiliere()

  const champs: FormulaireChamp[] = [
    {
      name: 'niveau',
      label: 'Niveau',
      type: 'select',
      required: true,
      options: versOptions(niveaux.data, optionNiveau),
    },
    {
      name: 'option_filiere',
      label: 'Option de filière',
      type: 'select',
      required: true,
      options: versOptions(options.data, optionOption),
    },
    {
      name: 'semestre',
      label: 'Semestre',
      type: 'select',
      required: true,
      options: [
        { value: 'S1', label: 'Semestre 1' },
        { value: 'S2', label: 'Semestre 2' },
      ],
    },
    { name: 'code', label: 'Code', required: true, placeholder: 'INF101' },
    { name: 'nom', label: 'Intitulé', required: true, colSpan: 2 },
    { name: 'coefficient', label: 'Coefficient', type: 'number', required: true, min: 1 },
    { name: 'credits', label: 'Crédits', type: 'number', min: 0 },
    { name: 'volume_horaire', label: 'Volume horaire (h)', type: 'number', required: true, min: 1 },
  ]

  return (
    <ResourcePage<Matiere>
      resource={R.matieres}
      titre="Matières"
      description="Matières par niveau, option de filière et semestre. Le coefficient pondère les moyennes."
      singulier="matière"
      peutEcrire={peutEcrire(user, 'referentielPedagogique')}
      searchPlaceholder="Rechercher une matière (code, intitulé)…"
      columns={[
        {
          key: 'code',
          header: 'Matière',
          primary: true,
          sortable: true,
          render: (matiere) => (
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{matiere.code}</Badge>
              <span className="font-medium">{matiere.nom}</span>
            </span>
          ),
        },
        {
          key: 'semestre',
          header: 'Semestre',
          render: (matiere) => (matiere.semestre === 'S1' ? 'S1' : 'S2'),
        },
        {
          key: 'coefficient',
          header: 'Coef.',
          align: 'center',
          render: (matiere) => matiere.coefficient,
        },
        {
          key: 'credits',
          header: 'Crédits',
          align: 'right',
          hideBelow: 'md',
          render: (matiere) => (matiere.credits ? nombre(matiere.credits) : '—'),
        },
        {
          key: 'volume_horaire',
          header: 'Heures',
          align: 'right',
          hideBelow: 'lg',
          render: (matiere) => `${nombre(matiere.volume_horaire)} h`,
        },
        {
          key: 'niveau',
          header: 'Niveau',
          hideBelow: 'lg',
          render: (matiere) => matiere.niveau_libelle,
        },
      ]}
      filtres={[
        { name: 'niveau', label: 'Niveau', options: versOptions(niveaux.data, optionNiveau) },
        {
          name: 'semestre',
          label: 'Semestre',
          options: [
            { value: 'S1', label: 'Semestre 1' },
            { value: 'S2', label: 'Semestre 2' },
          ],
        },
      ]}
      champs={champs}
    />
  )
}
