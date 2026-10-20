import { Landmark, Tags } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ResourcePage, type FormulaireChamp } from '@/components/data/ResourcePage'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/auth/AuthProvider'
import { peutEcrire } from '@/auth/permissions'
import { fcfa } from '@/lib/format'
import type { Compte } from '@/lib/types'
import { libelleTypeCompte, T } from './hooks'

const TYPES = [
  { value: 'CAISSE', label: 'Caisse' },
  { value: 'BANQUE', label: 'Banque' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'VIRTUEL', label: 'Virtuel' },
]

export function ComptesPage() {
  const { user } = useAuth()
  const ecriture = peutEcrire(user, 'tresorerie')

  const champs: FormulaireChamp[] = [
    { name: 'code', label: 'Code', required: true, placeholder: 'CAISSE-01' },
    { name: 'libelle', label: 'Libellé', required: true, placeholder: 'Caisse principale' },
    { name: 'type', label: 'Type de compte', type: 'select', required: true, options: TYPES },
    {
      name: 'solde_initial',
      label: 'Solde initial (FCFA)',
      type: 'number',
      min: 0,
      hint: 'Renseigné à la création ; les mouvements s’y ajoutent.',
    },
    { name: 'banque', label: 'Banque', hint: 'Pour les comptes bancaires.' },
    { name: 'numero_bancaire', label: 'Numéro de compte / téléphone', colSpan: 2 },
    { name: 'actif', label: 'Compte actif', type: 'checkbox' },
  ]

  return (
    <ResourcePage<Compte>
      resource={T.comptes}
      titre="Comptes de trésorerie"
      description="Caisses, comptes bancaires et portefeuilles Mobile Money. Le solde actuel est calculé à partir des mouvements validés."
      singulier="compte"
      pluriel="comptes"
      peutEcrire={ecriture}
      recherche={false}
      defaults={{ type: 'CAISSE', actif: true, solde_initial: 0 }}
      columns={[
        {
          key: 'libelle',
          header: 'Compte',
          primary: true,
          render: (compte) => (
            <span className="flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--brand-primary-subtle)] text-brand-700">
                <Landmark className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">{compte.libelle}</span>
                <span className="text-xs text-[var(--muted-foreground)]">{compte.code}</span>
              </span>
            </span>
          ),
        },
        {
          key: 'type',
          header: 'Type',
          render: (compte) => (
            <Badge tone="neutral">{libelleTypeCompte[compte.type] ?? compte.type}</Badge>
          ),
        },
        {
          key: 'banque',
          header: 'Banque',
          hideBelow: 'lg',
          render: (compte) => compte.banque ?? '—',
        },
        {
          key: 'solde_initial',
          header: 'Solde initial',
          align: 'right',
          hideBelow: 'md',
          render: (compte) => fcfa(compte.solde_initial),
        },
        {
          key: 'solde_actuel',
          header: 'Solde actuel',
          align: 'right',
          render: (compte) => (
            <span className="numeric font-bold text-brand-700">{fcfa(compte.solde_actuel)}</span>
          ),
        },
        {
          key: 'actif',
          header: 'État',
          render: (compte) => (
            <Badge tone={compte.actif ? 'success' : 'neutral'}>
              {compte.actif ? 'Actif' : 'Inactif'}
            </Badge>
          ),
        },
      ]}
      champs={champs}
      actionsSupplementaires={
        <Link
          to="/comptes/categories"
          className="control-h inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--surface-muted)]"
        >
          <Tags className="size-4" aria-hidden />
          Catégories de mouvement
        </Link>
      }
      filtres={[
        { name: 'type', label: 'Type', options: TYPES },
        {
          name: 'actif',
          label: 'État',
          options: [
            { value: 'true', label: 'Actifs' },
            { value: 'false', label: 'Inactifs' },
          ],
        },
      ]}
    />
  )
}
