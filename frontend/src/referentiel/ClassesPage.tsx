import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import type { Classe } from '@/lib/types'
import {
  optionAnnee,
  optionModalite,
  optionNiveau,
  optionOption,
  useAnnees,
  useModalites,
  useNiveaux,
  useOptionsFiliere,
  versOptions,
} from '@/referentiel/hooks'

export function ClassesPage() {
  const { user } = useAuth()
  const annees = useAnnees()
  const niveaux = useNiveaux()
  const options = useOptionsFiliere()
  const modalites = useModalites()

  const champs: FormulaireChamp[] = [
    {
      name: 'annee_scolaire',
      label: 'Année scolaire',
      type: 'select',
      required: true,
      options: versOptions(annees.data, optionAnnee),
    },
    {
      name: 'niveau',
      label: 'Niveau',
      type: 'select',
      required: true,
      options: versOptions(niveaux.data, optionNiveau),
    },
    {
      name: 'option_filiere',
      label: 'Option / filière',
      type: 'select',
      required: true,
      options: versOptions(options.data, optionOption),
    },
    {
      name: 'modalite_formation',
      label: 'Modalité de formation',
      type: 'select',
      required: true,
      options: versOptions(modalites.data, optionModalite),
    },
    {
      name: 'effectif_max',
      label: 'Effectif maximum',
      type: 'number',
      min: 1,
      hint: 'Laisser vide si aucun plafond n’est imposé.',
    },
  ]

  return (
    <ResourcePage<Classe>
      resource="referentiel/classes"
      titre="Classes"
      description="Le libellé de la classe est composé automatiquement (niveau, option, modalité, année) par le serveur."
      singulier="classe"
      peutEcrire={peutEcrire(user, 'referentiel')}
      searchPlaceholder="Rechercher une classe (ex. L1 INFO)…"
      columns={[
        {
          key: 'libelle_auto',
          header: 'Classe',
          primary: true,
          render: (classe) => (
            <span className="font-semibold text-[var(--foreground)]">{classe.libelle_auto}</span>
          ),
        },
        {
          key: 'niveau',
          header: 'Niveau',
          render: (classe) =>
            niveaux.data?.find((niveau) => niveau.id === classe.niveau)?.libelle ??
            `Niveau #${classe.niveau}`,
        },
        {
          key: 'option',
          header: 'Option',
          hideBelow: 'md',
          render: (classe) =>
            options.data?.find((option) => option.id === classe.option_filiere)?.sigle ??
            `Option #${classe.option_filiere}`,
        },
        {
          key: 'annee',
          header: 'Année',
          hideBelow: 'sm',
          render: (classe) =>
            annees.data?.find((annee) => annee.id === classe.annee_scolaire)?.libelle ??
            `Année #${classe.annee_scolaire}`,
        },
        {
          key: 'effectif_max',
          header: 'Effectif max',
          align: 'right',
          hideBelow: 'lg',
          render: (classe) =>
            classe.effectif_max === null ? (
              <Badge tone="neutral">Libre</Badge>
            ) : (
              <span className="numeric">{classe.effectif_max}</span>
            ),
        },
      ]}
      champs={champs}
      filtres={[
        {
          name: 'annee_scolaire',
          label: 'Année',
          options: versOptions(annees.data, optionAnnee),
        },
        { name: 'niveau', label: 'Niveau', options: versOptions(niveaux.data, optionNiveau) },
      ]}
    />
  )
}
