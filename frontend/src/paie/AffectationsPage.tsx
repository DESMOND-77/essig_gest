import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { fcfa } from '@/lib/format'
import type { AffectationEnseignement } from '@/lib/types'
import {
  optionAnnee,
  optionClasse,
  optionMatiere,
  useAnnees,
  useClasses,
  useMatieres,
  versOptions,
} from '@/referentiel/hooks'
import { useAll } from '@/lib/hooks'
import type { Enseignant } from '@/lib/types'
import { P } from './hooks'

export function AffectationsPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'rhPaie')
  const enseignants = useAll<Enseignant>(P.enseignants, { actif: 'true' })
  const matieres = useMatieres()
  const classes = useClasses()
  const annees = useAnnees()

  const optionsEnseignants = (enseignants.data ?? []).map((enseignant) => ({
    value: enseignant.id,
    label: `${enseignant.nom} ${enseignant.prenom}`,
  }))

  const champs: FormulaireChamp[] = [
    {
      name: 'enseignant',
      label: 'Enseignant',
      type: 'select',
      required: true,
      options: optionsEnseignants,
    },
    {
      name: 'matiere',
      label: 'Matière',
      type: 'select',
      required: true,
      options: versOptions(matieres.data, optionMatiere),
    },
    {
      name: 'classe',
      label: 'Classe',
      type: 'select',
      required: true,
      options: versOptions(classes.data, optionClasse),
    },
    {
      name: 'annee_scolaire',
      label: 'Année scolaire',
      type: 'select',
      required: true,
      options: versOptions(annees.data, optionAnnee),
    },
    {
      name: 'volume_horaire_prevu',
      label: 'Volume horaire prévu (h)',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'taux_horaire',
      label: 'Taux horaire (FCFA)',
      type: 'number',
      required: true,
      min: 0,
      hint: 'Le montant prévu est calculé par le serveur.',
    },
  ]

  return (
    <ResourcePage<AffectationEnseignement>
      resource={P.affectations}
      titre="Affectations d’enseignement"
      description="Répartition des matières entre enseignants et classes. Le montant prévu alimente la paie enseignante."
      singulier="affectation"
      peutEcrire={ecriture}
      recherche={false}
      columns={[
        {
          key: 'enseignant',
          header: 'Enseignant',
          primary: true,
          render: (affectation) => (
            <span className="font-semibold">{affectation.enseignant_nom ?? '—'}</span>
          ),
        },
        {
          key: 'matiere',
          header: 'Matière',
          render: (affectation) => affectation.matiere_nom,
        },
        {
          key: 'classe',
          header: 'Classe',
          hideBelow: 'md',
          render: (affectation) => affectation.classe_nom ?? `Classe #${affectation.classe}`,
        },
        {
          key: 'volume',
          header: 'Volume',
          align: 'right',
          hideBelow: 'lg',
          render: (affectation) => `${affectation.volume_horaire_prevu} h`,
        },
        {
          key: 'montant',
          header: 'Montant prévu',
          align: 'right',
          render: (affectation) => (
            <span className="numeric font-semibold">{fcfa(affectation.montant_prevu)}</span>
          ),
        },
      ]}
      champs={champs}
      filtres={[
        {
          name: 'enseignant',
          label: 'Enseignant',
          options: optionsEnseignants,
        },
        { name: 'classe', label: 'Classe', options: versOptions(classes.data, optionClasse) },
        { name: 'annee_scolaire', label: 'Année', options: versOptions(annees.data, optionAnnee) },
      ]}
    />
  )
}
