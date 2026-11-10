import { Power, PowerOff, UserSquare2 } from 'lucide-react'
import { useState } from 'react'

import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { fcfa } from '@/lib/format'
import { useAction } from '@/lib/hooks'
import type { Enseignant } from '@/lib/types'
import { P } from './hooks'

const champs: FormulaireChamp[] = [
  { name: 'nom', label: 'Nom', required: true },
  { name: 'prenom', label: 'Prénom(s)', required: true },
  { name: 'telephone', label: 'Téléphone', type: 'tel' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'specialite', label: 'Spécialité' },
  {
    name: 'statut',
    label: 'Statut',
    type: 'select',
    required: true,
    options: [
      { value: 'PERMANENT', label: 'Permanent' },
      { value: 'VACATAIRE', label: 'Vacataire' },
    ],
  },
  {
    name: 'taux_horaire',
    label: 'Taux horaire (FCFA)',
    type: 'number',
    min: 0,
    hint: 'Utilisé pour calculer le montant prévu des affectations.',
  },
  { name: 'actif', label: 'Enseignant actif', type: 'checkbox' },
]

export function EnseignantsPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'rhPaie')

  return (
    <ResourcePage<Enseignant>
      resource={P.enseignants}
      titre="Enseignants"
      description="Corps enseignant : permanents et vacataires, avec leur taux horaire pour la paie."
      singulier="enseignant"
      peutEcrire={ecriture}
      defaults={{ statut: 'VACATAIRE', actif: true }}
      searchPlaceholder="Rechercher un enseignant…"
      columns={[
        {
          key: 'nom',
          header: 'Enseignant',
          primary: true,
          render: (enseignant) => (
            <span className="flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--brand-primary-subtle)] text-brand-700">
                <UserSquare2 className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">
                  {enseignant.nom} {enseignant.prenom}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {enseignant.specialite ?? 'Spécialité non renseignée'}
                </span>
              </span>
            </span>
          ),
        },
        {
          key: 'statut',
          header: 'Statut',
          render: (enseignant) => (
            <Badge tone={enseignant.statut === 'PERMANENT' ? 'brand' : 'neutral'}>
              {enseignant.statut === 'PERMANENT' ? 'Permanent' : 'Vacataire'}
            </Badge>
          ),
        },
        {
          key: 'taux_horaire',
          header: 'Taux horaire',
          align: 'right',
          hideBelow: 'md',
          render: (enseignant) =>
            enseignant.taux_horaire === null ? '—' : fcfa(enseignant.taux_horaire),
        },
        {
          key: 'contact',
          header: 'Contact',
          hideBelow: 'lg',
          render: (enseignant) => enseignant.telephone ?? enseignant.email ?? '—',
        },
        {
          key: 'actif',
          header: 'État',
          render: (enseignant) => (
            <Badge tone={enseignant.actif ? 'success' : 'neutral'}>
              {enseignant.actif ? 'Actif' : 'Inactif'}
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
            { value: 'PERMANENT', label: 'Permanent' },
            { value: 'VACATAIRE', label: 'Vacataire' },
          ],
        },
        {
          name: 'actif',
          label: 'État',
          options: [
            { value: 'true', label: 'Actifs' },
            { value: 'false', label: 'Inactifs' },
          ],
        },
      ]}
      rowActions={(enseignant) => (
        <BoutonActivation
          enseignant={enseignant}
          libelle={enseignant.actif ? 'Désactiver' : 'Activer'}
          action={enseignant.actif ? 'desactiver' : 'activer'}
          actif={enseignant.actif}
        />
      )}
    />
  )
}

function BoutonActivation({
  enseignant,
  libelle,
  action,
  actif,
}: {
  enseignant: Enseignant
  libelle: string
  action: 'activer' | 'desactiver'
  actif: boolean
}) {
  const toast = useToast()
  const [ouvert, setOuvert] = useState(false)
  const mutation = useAction(`/api/v1/${P.enseignants}/${enseignant.id}/${action}/`, [P.enseignants])

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        icon={actif ? <PowerOff className="size-4" aria-hidden /> : <Power className="size-4" aria-hidden />}
        onClick={(event) => {
          event.stopPropagation()
          setOuvert(true)
        }}
      >
        {libelle}
      </Button>
      <ConfirmDialog
        open={ouvert}
        onClose={() => setOuvert(false)}
        onConfirm={async () => {
          try {
            await mutation.mutateAsync({})
            toast.succes(`Enseignant ${action === 'activer' ? 'activé' : 'désactivé'}`)
            setOuvert(false)
          } catch (error) {
            toast.erreur('Action impossible', (error as Error).message)
          }
        }}
        title={`${libelle} cet enseignant ?`}
        message={`${enseignant.nom} ${enseignant.prenom} ${
          actif ? 'ne pourra plus être affecté à de nouvelles classes.' : 'pourra de nouveau être affecté.'
        }`}
        confirmLabel={libelle}
        danger={actif}
        loading={mutation.isPending}
      />
    </>
  )
}
