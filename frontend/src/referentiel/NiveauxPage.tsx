import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { nombre } from '@/lib/format'
import type { Niveau } from '@/lib/types'
import { optionEcole, R, useEcoles, versOptions } from './hooks'

export function NiveauxPage() {
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
    { name: 'code', label: 'Code', required: true, placeholder: 'L1, M2…' },
    { name: 'libelle', label: 'Libellé', required: true, colSpan: 2 },
    { name: 'ordre', label: 'Ordre', type: 'number', required: true, min: 0 },
    { name: 'credits_requis', label: 'Crédits requis', type: 'number', min: 0 },
    { name: 'a_soutenance', label: 'Soutenance', type: 'checkbox' },
    { name: 'a_examen_national', label: 'Examen national', type: 'checkbox' },
  ]

  return (
    <ResourcePage<Niveau>
      resource={R.niveaux}
      titre="Niveaux"
      description="Niveaux d’études (L1, L2, M1…), leur ordre et les règles de validation associées."
      singulier="niveau"
      peutEcrire={peutEcrire(user, 'referentiel')}
      columns={[
        {
          key: 'code',
          header: 'Niveau',
          primary: true,
          sortable: true,
          render: (niveau) => (
            <span className="flex items-center gap-2">
              <Badge tone="brand">{niveau.code}</Badge>
              <span className="font-medium">{niveau.libelle}</span>
            </span>
          ),
        },
        { key: 'ecole', header: 'École', render: (niveau) => niveau.ecole_libelle },
        { key: 'ordre', header: 'Ordre', align: 'center', render: (niveau) => niveau.ordre },
        {
          key: 'credits_requis',
          header: 'Crédits requis',
          align: 'right',
          hideBelow: 'md',
          render: (niveau) => (niveau.credits_requis ? nombre(niveau.credits_requis) : '—'),
        },
        {
          key: 'regles',
          header: 'Règles',
          hideBelow: 'lg',
          render: (niveau) => (
            <span className="flex flex-wrap gap-1">
              {niveau.a_soutenance ? <Badge tone="accent">Soutenance</Badge> : null}
              {niveau.a_examen_national ? <Badge tone="neutral">Examen national</Badge> : null}
              {!niveau.a_soutenance && !niveau.a_examen_national ? '—' : null}
            </span>
          ),
        },
      ]}
      champs={champs}
      searchPlaceholder="Rechercher un niveau…"
      filtres={[
        {
          name: 'ecole',
          label: 'École',
          options: versOptions(ecoles.data, optionEcole),
        },
      ]}
    />
  )
}
