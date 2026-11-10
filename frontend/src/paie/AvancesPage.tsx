import { HandCoins } from 'lucide-react'
import { useState } from 'react'

import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { aujourdhui, dateCourte, fcfa } from '@/lib/format'
import { useAction, useAll } from '@/lib/hooks'
import type { AvancePersonnel, Enseignant, PersonnelAdministratif } from '@/lib/types'
import { useComptes } from '@/tresorerie/hooks'
import { P } from './hooks'

export function AvancesPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'rhPaie')
  const enseignants = useAll<Enseignant>(P.enseignants, { actif: 'true' })
  const personnel = useAll<PersonnelAdministratif>(P.personnel, { actif: 'true' })
  const comptes = useComptes()

  const champs: FormulaireChamp[] = [
    {
      name: 'beneficiaire',
      label: 'Type de bénéficiaire',
      type: 'select',
      required: true,
      options: [
        { value: 'ENSEIGNANT', label: 'Enseignant' },
        { value: 'ADMIN', label: 'Personnel administratif' },
      ],
      hint: 'Le champ enseignant ou personnel correspondant doit être renseigné.',
    },
    {
      name: 'enseignant',
      label: 'Enseignant',
      type: 'select',
      options: (enseignants.data ?? []).map((enseignant) => ({
        value: enseignant.id,
        label: `${enseignant.nom} ${enseignant.prenom}`,
      })),
      emptyValue: null,
    },
    {
      name: 'personnel_administratif',
      label: 'Personnel administratif',
      type: 'select',
      options: (personnel.data ?? []).map((membre) => ({
        value: membre.id,
        label: `${membre.nom} ${membre.prenom} — ${membre.poste}`,
      })),
      emptyValue: null,
    },
    { name: 'date', label: 'Date', type: 'date', required: true },
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
    {
      name: 'motif',
      label: 'Motif',
      type: 'textarea',
      colSpan: 2,
      hint: 'Une avance non régularisée est déduite du prochain salaire administratif.',
    },
  ]

  return (
    <ResourcePage<AvancePersonnel>
      resource={P.avances}
      titre="Avances sur salaire"
      description="Avances versées au personnel. Elles peuvent être régularisées sur le salaire administratif du mois."
      singulier="avance"
      peutEcrire={ecriture}
      recherche={false}
      peutSupprimer={ecriture}
      defaults={{ beneficiaire: 'ENSEIGNANT', date: aujourdhui() }}
      columns={[
        {
          key: 'beneficiaire',
          header: 'Bénéficiaire',
          primary: true,
          render: (avance) => (
            <span>
              <span className="block font-semibold">
                {avance.enseignant_nom ?? avance.personnel_administratif_nom ?? '—'}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {avance.beneficiaire === 'ENSEIGNANT' ? 'Enseignant' : 'Personnel administratif'}
              </span>
            </span>
          ),
        },
        {
          key: 'date',
          header: 'Date',
          hideBelow: 'sm',
          render: (avance) => dateCourte(avance.date),
        },
        {
          key: 'montant',
          header: 'Montant',
          align: 'right',
          render: (avance) => (
            <span className="numeric font-semibold">{fcfa(avance.montant)}</span>
          ),
        },
        {
          key: 'compte',
          header: 'Compte',
          hideBelow: 'lg',
          render: (avance) => avance.compte_code,
        },
        {
          key: 'regularisee',
          header: 'Régularisation',
          render: (avance) => (
            <Badge tone={avance.regularisee ? 'success' : 'warning'}>
              {avance.regularisee ? 'Régularisée' : 'En attente'}
            </Badge>
          ),
        },
      ]}
      champs={champs}
      filtres={[
        {
          name: 'beneficiaire',
          label: 'Bénéficiaire',
          options: [
            { value: 'ENSEIGNANT', label: 'Enseignants' },
            { value: 'ADMIN', label: 'Administration' },
          ],
        },
        {
          name: 'regularisee',
          label: 'Régularisation',
          options: [
            { value: 'true', label: 'Régularisées' },
            { value: 'false', label: 'En attente' },
          ],
        },
      ]}
      rowActions={(avance) =>
        !avance.regularisee && avance.beneficiaire === 'ADMIN' && ecriture ? (
          <BoutonRegulariser avance={avance} />
        ) : null
      }
    />
  )
}

function BoutonRegulariser({ avance }: { avance: AvancePersonnel }) {
  const toast = useToast()
  const [ouvert, setOuvert] = useState(false)
  const mutation = useAction(`/api/v1/${P.avances}/${avance.id}/regulariser/`, [P.avances])

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon={<HandCoins className="size-4" aria-hidden />}
        onClick={(event) => {
          event.stopPropagation()
          setOuvert(true)
        }}
      >
        Régulariser
      </Button>
      <ConfirmDialog
        open={ouvert}
        onClose={() => setOuvert(false)}
        onConfirm={async () => {
          try {
            await mutation.mutateAsync({})
            toast.succes('Avance régularisée', 'Elle sera déduite du salaire administratif.')
            setOuvert(false)
          } catch (error) {
            toast.erreur('Régularisation impossible', (error as Error).message)
          }
        }}
        title="Régulariser cette avance ?"
        message={
          <>
            {fcfa(avance.montant)} versés à{' '}
            <strong>{avance.personnel_administratif_nom ?? 'ce membre du personnel'}</strong>. Le
            montant sera déduit de son salaire administratif du mois.
          </>
        }
        confirmLabel="Régulariser"
        loading={mutation.isPending}
      />
    </>
  )
}
