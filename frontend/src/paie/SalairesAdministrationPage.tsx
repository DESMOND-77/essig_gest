import { Wallet } from 'lucide-react'

import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { dateCourte, fcfa } from '@/lib/format'
import { useAll } from '@/lib/hooks'
import type { PersonnelAdministratif, SalaireAdministration } from '@/lib/types'
import { useComptes } from '@/tresorerie/hooks'
import { optionAnnee, useAnnees, versOptions } from '@/referentiel/hooks'
import { libelleMois, libelleStatutSalaire, MOIS, moisCourant, P } from './hooks'
import { ActionSalaire } from './SalairesEnseignantsPage'

export function SalairesAdministrationPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'rhPaie')
  const validation = peutEcrire(user, 'rhPaieValidation')
  const personnel = useAll<PersonnelAdministratif>(P.personnel)
  const annees = useAnnees()
  const comptes = useComptes()

  const champs: FormulaireChamp[] = [
    {
      name: 'personnel_administratif',
      label: 'Membre du personnel',
      type: 'select',
      required: true,
      options: (personnel.data ?? []).map((membre) => ({
        value: membre.id,
        label: `${membre.nom} ${membre.prenom} — ${membre.poste}`,
      })),
    },
    {
      name: 'annee_scolaire',
      label: 'Année scolaire',
      type: 'select',
      required: true,
      options: versOptions(annees.data, optionAnnee),
    },
    { name: 'mois', label: 'Mois', type: 'select', required: true, options: MOIS },
    { name: 'date_paiement', label: 'Date de paiement', type: 'date', required: true },
    { name: 'montant_du', label: 'Montant dû (FCFA)', type: 'number', required: true, min: 1 },
    {
      name: 'montant_paye',
      label: 'Montant payé (FCFA)',
      type: 'number',
      min: 0,
      hint: 'Peut différer du dû si une avance a déjà été versée.',
    },
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
    <ResourcePage<SalaireAdministration>
      resource={P.salairesAdministration}
      titre="Salaires administration"
      description="Bulletins de paie du personnel administratif, avec déduction éventuelle des avances régularisées."
      singulier="salaire"
      peutEcrire={ecriture}
      recherche={false}
      peutSupprimer={ecriture}
      defaults={{ mois: moisCourant() }}
      columns={[
        {
          key: 'personnel',
          header: 'Personnel',
          primary: true,
          render: (salaire) => (
            <span className="font-semibold">{salaire.personnel_administratif_nom ?? '—'}</span>
          ),
        },
        {
          key: 'periode',
          header: 'Période',
          render: (salaire) =>
            `${libelleMois[salaire.mois] ?? salaire.mois} · ${salaire.annee_scolaire_libelle}`,
        },
        {
          key: 'du',
          header: 'Dû',
          align: 'right',
          hideBelow: 'md',
          render: (salaire) => <span className="numeric">{fcfa(salaire.montant_du)}</span>,
        },
        {
          key: 'paye',
          header: 'Payé',
          align: 'right',
          render: (salaire) => (
            <span className="numeric font-semibold">{fcfa(salaire.montant_paye)}</span>
          ),
        },
        {
          key: 'date_paiement',
          header: 'Date',
          hideBelow: 'lg',
          render: (salaire) => dateCourte(salaire.date_paiement),
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
      ]}
      rowActions={(salaire) => (
        <>
          {salaire.statut === 'BROUILLON' && validation ? (
            <ActionSalaire
              salaire={{
                id: salaire.id,
                montant: salaire.montant_paye,
                enseignant_nom: salaire.personnel_administratif_nom,
              }}
              action="valider"
              label="Valider"
              titre="Valider ce salaire ?"
              message="Le montant sera figé et pourra être payé."
              succes="Salaire validé"
            />
          ) : null}
          {salaire.statut === 'VALIDÉ' && ecriture ? (
            <ActionSalaire
              salaire={{
                id: salaire.id,
                montant: salaire.montant_paye,
                enseignant_nom: salaire.personnel_administratif_nom,
              }}
              action="payer"
              label="Payer"
              titre="Payer ce salaire ?"
              message="Un mouvement de débit sera créé sur le compte indiqué."
              succes="Salaire payé"
            />
          ) : null}
        </>
      )}
      extraToolbar={
        <span className="hidden text-xs text-[var(--muted-foreground)] sm:inline">
          <Wallet className="mr-1 inline size-4" aria-hidden />
          Circuit : brouillon → validé (direction) → payé
        </span>
      }
    />
  )
}
