import { BadgeCheck, Wallet } from 'lucide-react'
import { useState } from 'react'

import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { dateCourte, fcfa } from '@/lib/format'
import { useAction, useAll } from '@/lib/hooks'
import type { Enseignant, SalaireEnseignant } from '@/lib/types'
import { useComptes } from '@/tresorerie/hooks'
import { optionAnnee, useAnnees, versOptions } from '@/referentiel/hooks'
import {
  libelleMois,
  libelleStatutSalaire,
  MOIS,
  moisCourant,
  optionAffectation,
  P,
  useAffectations,
} from './hooks'

export function SalairesEnseignantsPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'rhPaie')
  const validation = peutEcrire(user, 'rhPaieValidation')
  const enseignants = useAll<Enseignant>(P.enseignants)
  const affectations = useAffectations()
  const annees = useAnnees()
  const comptes = useComptes()

  const champs: FormulaireChamp[] = [
    {
      name: 'enseignant',
      label: 'Enseignant',
      type: 'select',
      required: true,
      options: (enseignants.data ?? []).map((enseignant) => ({
        value: enseignant.id,
        label: `${enseignant.nom} ${enseignant.prenom}`,
      })),
    },
    {
      name: 'affectation_enseignement',
      label: 'Affectation',
      type: 'select',
      options: versOptions(affectations.data, optionAffectation),
      emptyValue: null,
      hint: 'Facultatif : rattache le salaire à une affectation précise.',
    },
    {
      name: 'annee_scolaire',
      label: 'Année scolaire',
      type: 'select',
      required: true,
      options: versOptions(annees.data, optionAnnee),
    },
    {
      name: 'mois',
      label: 'Mois',
      type: 'select',
      required: true,
      options: MOIS,
    },
    { name: 'date_paiement', label: 'Date de paiement', type: 'date', required: true },
    { name: 'montant', label: 'Montant (FCFA)', type: 'number', required: true, min: 1 },
    {
      name: 'compte',
      label: 'Compte débité',
      type: 'select',
      required: true,
      options: (comptes.data ?? []).map((compte) => ({
        value: compte.id,
        label: `${compte.code} — ${compte.libelle}`,
      })),
    },
  ]

  return (
    <ResourcePage<SalaireEnseignant>
      resource={P.salairesEnseignants}
      titre="Salaires enseignants"
      description="Bulletins de paie du corps enseignant. Chaque ligne suit le circuit brouillon → validé → payé."
      singulier="salaire"
      peutEcrire={ecriture}
      recherche={false}
      peutSupprimer={ecriture}
      defaults={{ mois: moisCourant() }}
      columns={[
        {
          key: 'enseignant',
          header: 'Enseignant',
          primary: true,
          render: (salaire) => <span className="font-semibold">{salaire.enseignant_nom ?? '—'}</span>,
        },
        {
          key: 'periode',
          header: 'Période',
          render: (salaire) => `${libelleMois[salaire.mois] ?? salaire.mois} · ${salaire.annee_scolaire_libelle}`,
        },
        {
          key: 'montant',
          header: 'Montant',
          align: 'right',
          render: (salaire) => (
            <span className="numeric font-semibold">{fcfa(salaire.montant)}</span>
          ),
        },
        {
          key: 'date_paiement',
          header: 'Paiement',
          hideBelow: 'md',
          render: (salaire) => dateCourte(salaire.date_paiement),
        },
        {
          key: 'compte',
          header: 'Compte',
          hideBelow: 'xl',
          render: (salaire) => salaire.compte_code,
        },
        {
          key: 'statut',
          header: 'Statut',
          render: (salaire) => (
            <Badge
              tone={
                salaire.statut === 'PAYÉ'
                  ? 'success'
                  : salaire.statut === 'VALIDÉ'
                    ? 'brand'
                    : 'neutral'
              }
            >
              {libelleStatutSalaire[salaire.statut] ?? salaire.statut}
            </Badge>
          ),
        },
      ]}
      champs={champs}
      filtres={[
        { name: 'mois', label: 'Mois', options: MOIS },
        {
          name: 'statut',
          label: 'Statut',
          options: [
            { value: 'BROUILLON', label: 'Brouillon' },
            { value: 'VALIDÉ', label: 'Validé' },
            { value: 'PAYÉ', label: 'Payé' },
          ],
        },
        { name: 'annee_scolaire', label: 'Année', options: versOptions(annees.data, optionAnnee) },
      ]}
      rowActions={(salaire) => (
        <>
          {salaire.statut === 'BROUILLON' && validation ? (
            <ActionSalaire
              salaire={salaire}
              action="valider"
              label="Valider"
              titre="Valider ce salaire ?"
              message="Le montant sera figé et pourra ensuite être payé."
              succes="Salaire validé"
            />
          ) : null}
          {salaire.statut === 'VALIDÉ' && ecriture ? (
            <ActionSalaire
              salaire={salaire}
              action="payer"
              label="Payer"
              titre="Payer ce salaire ?"
              message="Un mouvement de débit sera créé sur le compte indiqué."
              succes="Salaire payé"
            />
          ) : null}
        </>
      )}
    />
  )
}

export function ActionSalaire({
  salaire,
  action,
  label,
  titre,
  message,
  succes,
}: {
  salaire: SalaireEnseignant | { id: number; montant: string | number; enseignant_nom?: string | null }
  action: 'valider' | 'payer'
  label: string
  titre: string
  message: string
  succes: string
}) {
  const toast = useToast()
  const [ouvert, setOuvert] = useState(false)
  const mutation = useAction(
    `/api/v1/${P.salairesEnseignants}/${salaire.id}/${action}/`,
    [P.salairesEnseignants, P.salairesAdministration],
  )

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon={
          action === 'valider' ? (
            <BadgeCheck className="size-4" aria-hidden />
          ) : (
            <Wallet className="size-4" aria-hidden />
          )
        }
        onClick={(event) => {
          event.stopPropagation()
          setOuvert(true)
        }}
      >
        {label}
      </Button>
      <ConfirmDialog
        open={ouvert}
        onClose={() => setOuvert(false)}
        onConfirm={async () => {
          try {
            await mutation.mutateAsync({})
            toast.succes(succes)
            setOuvert(false)
          } catch (error) {
            toast.erreur(`${label} impossible`, (error as Error).message)
          }
        }}
        title={titre}
        message={
          <>
            {salaire.enseignant_nom ? `${salaire.enseignant_nom} — ` : ''}
            <strong>{fcfa(salaire.montant)}</strong>. {message}
          </>
        }
        confirmLabel={label}
        loading={mutation.isPending}
      />
    </>
  )
}
