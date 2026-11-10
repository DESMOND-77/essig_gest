import { Power, PowerOff } from 'lucide-react'
import { useState } from 'react'

import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { dateCourte, fcfa } from '@/lib/format'
import { useAction } from '@/lib/hooks'
import type { PersonnelAdministratif } from '@/lib/types'
import { optionEcole, useEcoles, versOptions } from '@/referentiel/hooks'
import { P } from './hooks'

export function PersonnelPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'rhPaie')
  const ecoles = useEcoles()

  const champs: FormulaireChamp[] = [
    { name: 'nom', label: 'Nom', required: true },
    { name: 'prenom', label: 'Prénom(s)', required: true },
    { name: 'poste', label: 'Poste', required: true, placeholder: 'Comptable, secrétaire…' },
    {
      name: 'ecole',
      label: 'École',
      type: 'select',
      required: true,
      options: versOptions(ecoles.data, optionEcole),
    },
    { name: 'telephone', label: 'Téléphone', type: 'tel' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'salaire_base', label: 'Salaire de base (FCFA)', type: 'number', min: 0, required: true },
    { name: 'date_embauche', label: 'Date d’embauche', type: 'date' },
    { name: 'actif', label: 'Personnel actif', type: 'checkbox' },
  ]

  return (
    <ResourcePage<PersonnelAdministratif>
      resource={P.personnel}
      titre="Personnel administratif"
      description="Secrétariat, comptabilité, direction : personnel non enseignant rattaché à une école."
      singulier="membre du personnel"
      peutEcrire={ecriture}
      defaults={{ actif: true, salaire_base: 0 }}
      searchPlaceholder="Rechercher un membre du personnel…"
      columns={[
        {
          key: 'nom',
          header: 'Personnel',
          primary: true,
          render: (personnel) => (
            <span>
              <span className="block font-semibold">
                {personnel.nom} {personnel.prenom}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">{personnel.poste}</span>
            </span>
          ),
        },
        {
          key: 'ecole',
          header: 'École',
          hideBelow: 'md',
          render: (personnel) => personnel.ecole_nom ?? `École #${personnel.ecole}`,
        },
        {
          key: 'salaire',
          header: 'Salaire de base',
          align: 'right',
          render: (personnel) => (
            <span className="numeric font-semibold">{fcfa(personnel.salaire_base)}</span>
          ),
        },
        {
          key: 'embauche',
          header: 'Embauche',
          hideBelow: 'lg',
          render: (personnel) =>
            personnel.date_embauche ? dateCourte(personnel.date_embauche) : '—',
        },
        {
          key: 'actif',
          header: 'État',
          render: (personnel) => (
            <Badge tone={personnel.actif ? 'success' : 'neutral'}>
              {personnel.actif ? 'Actif' : 'Inactif'}
            </Badge>
          ),
        },
      ]}
      champs={champs}
      filtres={[
        { name: 'ecole', label: 'École', options: versOptions(ecoles.data, optionEcole) },
        {
          name: 'actif',
          label: 'État',
          options: [
            { value: 'true', label: 'Actifs' },
            { value: 'false', label: 'Inactifs' },
          ],
        },
      ]}
      rowActions={(personnel) => (
        <BoutonActivationPersonnel
          personnel={personnel}
          libelle={personnel.actif ? 'Désactiver' : 'Activer'}
          action={personnel.actif ? 'desactiver' : 'activer'}
          actif={personnel.actif}
        />
      )}
    />
  )
}

function BoutonActivationPersonnel({
  personnel,
  libelle,
  action,
  actif,
}: {
  personnel: PersonnelAdministratif
  libelle: string
  action: 'activer' | 'desactiver'
  actif: boolean
}) {
  const toast = useToast()
  const [ouvert, setOuvert] = useState(false)
  const mutation = useAction(`/api/v1/${P.personnel}/${personnel.id}/${action}/`, [P.personnel])

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
            toast.succes(`Personnel ${action === 'activer' ? 'activé' : 'désactivé'}`)
            setOuvert(false)
          } catch (error) {
            toast.erreur('Action impossible', (error as Error).message)
          }
        }}
        title={`${libelle} ce membre du personnel ?`}
        message={`${personnel.nom} ${personnel.prenom} — ${personnel.poste}.`}
        confirmLabel={libelle}
        danger={actif}
        loading={mutation.isPending}
      />
    </>
  )
}
