import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { usePagedList } from '@/lib/hooks'
import type { CategorieMouvement } from '@/lib/types'
import { T } from './hooks'

const SENS = [
  { value: 'ENTREE', label: 'Entrée' },
  { value: 'SORTIE', label: 'Sortie' },
  { value: 'NEUTRE', label: 'Neutre (virement)' },
]

const champs: FormulaireChamp[] = [
  { name: 'code', label: 'Code', required: true, hint: 'Identifiant court, en majuscules.' },
  { name: 'libelle', label: 'Libellé', required: true },
  { name: 'sens', label: 'Sens', type: 'select', required: true, options: SENS, colSpan: 2 },
]

export function CategoriesMouvementPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'tresorerie')
  const resume = usePagedList<CategorieMouvement>(T.categories, { page: 1 })

  const entrees = resume.data?.results.filter((categorie) => categorie.sens === 'ENTREE').length ?? 0
  const sorties = resume.data?.results.filter((categorie) => categorie.sens === 'SORTIE').length ?? 0

  return (
    <ResourcePage<CategorieMouvement>
      resource={T.categories}
      titre="Catégories de mouvement"
      description={`${entrees} catégorie(s) d’entrée, ${sorties} de sortie. Elles classent les encaissements, dépenses et virements dans les états financiers.`}
      singulier="catégorie"
      peutEcrire={ecriture}
      recherche={false}
      defaults={{ sens: 'ENTREE' }}
      columns={[
        {
          key: 'libelle',
          header: 'Catégorie',
          primary: true,
          render: (categorie) => (
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs text-[var(--muted-foreground)]">
                {categorie.code}
              </span>
              <span className="font-semibold">{categorie.libelle}</span>
            </span>
          ),
        },
        {
          key: 'sens',
          header: 'Sens',
          render: (categorie) => (
            <Badge
              tone={
                categorie.sens === 'ENTREE'
                  ? 'success'
                  : categorie.sens === 'SORTIE'
                    ? 'danger'
                    : 'neutral'
              }
            >
              {SENS.find((sens) => sens.value === categorie.sens)?.label ?? categorie.sens}
            </Badge>
          ),
        },
      ]}
      champs={champs}
      filtres={[{ name: 'sens', label: 'Sens', options: SENS }]}
    />
  )
}
