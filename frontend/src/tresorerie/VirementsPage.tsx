import { ArrowLeftRight, CheckCheck, XCircle } from 'lucide-react'
import { useState } from 'react'

import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { aujourdhui, dateCourte, fcfa } from '@/lib/format'
import { useAction } from '@/lib/hooks'
import type { Compte, Virement } from '@/lib/types'
import { libelleStatutVirement, T, useComptes } from './hooks'

export function VirementsPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'tresorerie')
  const validation = peutEcrire(user, 'tresorerieValidation')
  const comptes = useComptes()

  const champs: FormulaireChamp[] = [
    {
      name: 'compte_source',
      label: 'Compte source',
      type: 'select',
      required: true,
      options: (comptes.data ?? []).map((compte: Compte) => ({
        value: compte.id,
        label: `${compte.code} — ${compte.libelle} (${fcfa(compte.solde_actuel)})`,
      })),
    },
    {
      name: 'compte_destination',
      label: 'Compte destination',
      type: 'select',
      required: true,
      options: (comptes.data ?? []).map((compte: Compte) => ({
        value: compte.id,
        label: `${compte.code} — ${compte.libelle} (${fcfa(compte.solde_actuel)})`,
      })),
    },
    { name: 'montant', label: 'Montant (FCFA)', type: 'number', required: true, min: 1 },
    { name: 'date', label: 'Date', type: 'date', required: true },
    {
      name: 'motif',
      label: 'Motif',
      type: 'textarea',
      required: true,
      colSpan: 2,
      hint: 'Ex. : alimentation de la caisse principale depuis le compte bancaire.',
    },
  ]

  return (
    <ResourcePage<Virement>
      resource={T.virements}
      titre="Virements internes"
      description="Transférez des fonds d’un compte à un autre. Un virement doit être engagé puis validé pour produire les mouvements."
      singulier="virement"
      peutEcrire={ecriture}
      recherche={false}
      defaults={{ date: aujourdhui() }}
      columns={[
        {
          key: 'compte_source_code',
          header: 'Trajet',
          primary: true,
          render: (virement) => (
            <span className="flex flex-wrap items-center gap-1.5 font-semibold">
              {virement.compte_source_code}
              <ArrowLeftRight className="size-3.5 text-[var(--muted-foreground)]" aria-hidden />
              {virement.compte_destination_code}
            </span>
          ),
        },
        {
          key: 'montant',
          header: 'Montant',
          align: 'right',
          render: (virement) => (
            <span className="numeric font-semibold">{fcfa(virement.montant)}</span>
          ),
        },
        {
          key: 'date',
          header: 'Date',
          hideBelow: 'md',
          render: (virement) => dateCourte(virement.date),
        },
        {
          key: 'motif',
          header: 'Motif',
          hideBelow: 'lg',
          render: (virement) => (
            <span className="line-clamp-1 text-[var(--muted-foreground)]">{virement.motif}</span>
          ),
        },
        {
          key: 'statut',
          header: 'Statut',
          render: (virement) => (
            <Badge
              tone={
                virement.statut === 'VALIDE'
                  ? 'success'
                  : virement.statut === 'ANNULE'
                    ? 'neutral'
                    : 'warning'
              }
            >
              {libelleStatutVirement[virement.statut] ?? virement.statut}
            </Badge>
          ),
        },
      ]}
      champs={champs}
      filtres={[
        {
          name: 'statut',
          label: 'Statut',
          options: [
            { value: 'BROUILLON', label: 'Brouillon' },
            { value: 'EN_ATTENTE_VALIDATION', label: 'En attente' },
            { value: 'VALIDE', label: 'Validé' },
            { value: 'ANNULE', label: 'Annulé' },
          ],
        },
      ]}
      rowActions={(virement) => (
        <>
          {virement.statut === 'BROUILLON' && ecriture ? (
            <ActionVirement
              virement={virement}
              action="engager"
              label="Engager"
              icone={<ArrowLeftRight className="size-4" aria-hidden />}
              titre="Engager le virement ?"
              message="Le virement passe en attente de validation par la direction."
              succes="Virement engagé"
            />
          ) : null}
          {virement.statut === 'EN_ATTENTE_VALIDATION' && validation ? (
            <>
              <ActionVirement
                virement={virement}
                action="valider"
                label="Valider"
                icone={<CheckCheck className="size-4" aria-hidden />}
                titre="Valider le virement ?"
                message="Les mouvements de débit et de crédit seront créés sur les deux comptes."
                succes="Virement validé"
              />
              <ActionVirement
                virement={virement}
                action="annuler"
                label="Annuler"
                icone={<XCircle className="size-4" aria-hidden />}
                titre="Annuler le virement ?"
                message="Le virement sera abandonné sans mouvement de fonds."
                succes="Virement annulé"
                danger
              />
            </>
          ) : null}
        </>
      )}
    />
  )
}

function ActionVirement({
  virement,
  action,
  label,
  icone,
  titre,
  message,
  succes,
  danger = false,
}: {
  virement: Virement
  action: 'engager' | 'valider' | 'annuler'
  label: string
  icone: React.ReactNode
  titre: string
  message: string
  succes: string
  danger?: boolean
}) {
  const toast = useToast()
  const [ouvert, setOuvert] = useState(false)
  const mutation = useAction(`/api/v1/${T.virements}/${virement.id}/${action}/`, [T.virements, T.mouvements])

  return (
    <>
      <Button
        size="sm"
        variant={danger ? 'ghost' : 'secondary'}
        icon={icone}
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
            {message}
            <br />
            <span className="numeric font-semibold">
              {fcfa(virement.montant)} — {virement.compte_source_code} → {virement.compte_destination_code}
            </span>
          </>
        }
        confirmLabel={label}
        danger={danger}
        loading={mutation.isPending}
      />
    </>
  )
}
