import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { fcfa } from '@/lib/format'
import type { ModalitePaiement } from '@/lib/types'
import {
  optionAnnee,
  optionNiveau,
  useAnnees,
  useNiveaux,
  versOptions,
} from '@/referentiel/hooks'

export function ModalitesPaiementPage() {
  const { user } = useAuth()
  const niveaux = useNiveaux()
  const annees = useAnnees()

  const champs: FormulaireChamp[] = [
    {
      name: 'niveau',
      label: 'Niveau',
      type: 'select',
      required: true,
      options: versOptions(niveaux.data, optionNiveau),
    },
    {
      name: 'annee_scolaire',
      label: 'Année scolaire',
      type: 'select',
      required: true,
      options: versOptions(annees.data, optionAnnee),
    },
    {
      name: 'montant_inscription_reinscription',
      label: 'Frais d’inscription / réinscription (FCFA)',
      type: 'number',
      required: true,
      min: 0,
      colSpan: 2,
    },
    {
      name: 'nombre_echeance',
      label: 'Nombre d’échéances',
      type: 'number',
      required: true,
      min: 1,
      max: 12,
    },
    {
      name: 'montant_echeance',
      label: 'Montant par échéance (FCFA)',
      type: 'number',
      required: true,
      min: 0,
    },
  ]

  return (
    <ResourcePage<ModalitePaiement>
      resource="scolarite/modalites-paiement"
      titre="Modalités de paiement"
      description="Barème de scolarité par niveau et par année : frais d’inscription, nombre d’échéances et montant mensuel. Le total est calculé par le serveur."
      singulier="modalité"
      peutEcrire={peutEcrire(user, 'scolariteTarifs')}
      recherche={false}
      columns={[
        {
          key: 'niveau',
          header: 'Niveau',
          primary: true,
          render: (modalite) => (
            <span className="font-semibold">
              {niveaux.data?.find((niveau) => niveau.id === modalite.niveau)?.libelle ??
                `Niveau #${modalite.niveau}`}
            </span>
          ),
        },
        {
          key: 'annee',
          header: 'Année',
          render: (modalite) =>
            annees.data?.find((annee) => annee.id === modalite.annee_scolaire)?.libelle ??
            `Année #${modalite.annee_scolaire}`,
        },
        {
          key: 'inscription',
          header: 'Inscription',
          align: 'right',
          hideBelow: 'md',
          render: (modalite) => fcfa(modalite.montant_inscription_reinscription),
        },
        {
          key: 'echeances',
          header: 'Échéances',
          align: 'right',
          render: (modalite) => `${modalite.nombre_echeance} × ${fcfa(modalite.montant_echeance)}`,
        },
        {
          key: 'total',
          header: 'Total annuel',
          align: 'right',
          render: (modalite) => (
            <span className="numeric font-bold text-brand-700">{fcfa(modalite.montant_total)}</span>
          ),
        },
      ]}
      champs={champs}
      filtres={[
        { name: 'niveau', label: 'Niveau', options: versOptions(niveaux.data, optionNiveau) },
        { name: 'annee_scolaire', label: 'Année', options: versOptions(annees.data, optionAnnee) },
      ]}
    />
  )
}
