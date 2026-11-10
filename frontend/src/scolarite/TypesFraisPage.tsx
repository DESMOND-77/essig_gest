import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { fcfa } from '@/lib/format'
import type { TypeFrais } from '@/lib/types'
import {
  optionAnnee,
  optionEcole,
  optionNiveau,
  useAnnees,
  useEcoles,
  useNiveaux,
  versOptions,
} from '@/referentiel/hooks'

export function TypesFraisPage() {
  const { user } = useAuth()
  const ecoles = useEcoles()
  const niveaux = useNiveaux()
  const annees = useAnnees()

  const champs: FormulaireChamp[] = [
    { name: 'code', label: 'Code', required: true, placeholder: 'FRAIS-DOSSIER' },
    { name: 'libelle', label: 'Libellé', required: true },
    {
      name: 'montant_defaut',
      label: 'Montant par défaut (FCFA)',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'ecole',
      label: 'École',
      type: 'select',
      options: versOptions(ecoles.data, optionEcole),
      emptyValue: null,
      hint: 'Vide = s’applique à toutes les écoles.',
    },
    {
      name: 'niveau',
      label: 'Niveau',
      type: 'select',
      options: versOptions(niveaux.data, optionNiveau),
      emptyValue: null,
      hint: 'Vide = tous les niveaux.',
    },
    {
      name: 'annee_scolaire',
      label: 'Année scolaire',
      type: 'select',
      options: versOptions(annees.data, optionAnnee),
      emptyValue: null,
      hint: 'Vide = toutes les années.',
    },
    { name: 'obligatoire', label: 'Frais obligatoire', type: 'checkbox', colSpan: 2 },
    { name: 'actif', label: 'Actif', type: 'checkbox', colSpan: 2 },
    { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
  ]

  return (
    <ResourcePage<TypeFrais>
      resource="scolarite/types-frais"
      titre="Types de frais"
      description="Catalogue des frais annexes (dossier, assurance, tenue, examen…). Les frais obligatoires sont ajoutés automatiquement à l’inscription."
      singulier="type de frais"
      peutEcrire={peutEcrire(user, 'scolariteTarifs')}
      defaults={{ actif: true, obligatoire: false, montant_defaut: 0 }}
      columns={[
        {
          key: 'libelle',
          header: 'Frais',
          primary: true,
          render: (frais) => (
            <span>
              <span className="block font-semibold">{frais.libelle}</span>
              <span className="font-mono text-xs text-[var(--muted-foreground)]">{frais.code}</span>
            </span>
          ),
        },
        {
          key: 'montant_defaut',
          header: 'Montant',
          align: 'right',
          render: (frais) => (
            <span className="numeric font-semibold">{fcfa(frais.montant_defaut)}</span>
          ),
        },
        {
          key: 'obligatoire',
          header: 'Obligatoire',
          hideBelow: 'md',
          render: (frais) => (
            <Badge tone={frais.obligatoire ? 'brand' : 'neutral'}>
              {frais.obligatoire ? 'Oui' : 'Non'}
            </Badge>
          ),
        },
        {
          key: 'ecole',
          header: 'École',
          hideBelow: 'lg',
          render: (frais) =>
            ecoles.data?.find((ecole) => ecole.id === frais.ecole)?.sigle ?? 'Toutes',
        },
        {
          key: 'actif',
          header: 'État',
          render: (frais) => (
            <Badge tone={frais.actif ? 'success' : 'neutral'}>
              {frais.actif ? 'Actif' : 'Inactif'}
            </Badge>
          ),
        },
      ]}
      champs={champs}
    />
  )
}
