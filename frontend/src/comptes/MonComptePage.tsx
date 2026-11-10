import { KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { useAuth } from '@/auth/AuthProvider'
import { libelleRole, possedeRole } from '@/auth/permissions'
import { initiales } from '@/lib/format'

export function MonComptePage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <>
      <PageHeader
        title="Mon compte"
        description="Informations de connexion et rôles attribués sur la plateforme."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardBody className="flex flex-col items-center text-center">
            <span className="grid size-20 place-items-center rounded-full bg-brand-600 text-2xl font-bold text-white">
              {initiales(user.login, user.login.slice(1))}
            </span>
            <h2 className="mt-3 text-lg font-bold">{user.login}</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{user.email || 'Email non renseigné'}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {user.roles.map((role) => (
                <Badge key={`${role.code}-${role.ecole_id ?? 'all'}`} tone="brand">
                  {libelleRole(role.code)}
                </Badge>
              ))}
              {user.roles.length === 0 ? <Badge tone="neutral">Aucun rôle</Badge> : null}
            </div>
            {user.roles.some((role) => role.code === 'DIRECTION') ? (
              <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--success)]">
                <ShieldCheck className="size-4" aria-hidden />
                Accès direction
              </p>
            ) : null}
          </CardBody>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Identifiants"
              description="Le jeton d’accès est conservé en mémoire et renouvelé automatiquement."
            />
            <CardBody className="space-y-3">
              <Ligne icone={<UserRound className="size-4" aria-hidden />} label="Identifiant" valeur={user.login} />
              <Ligne icone={<Mail className="size-4" aria-hidden />} label="Email" valeur={user.email || '—'} />
              <Ligne
                icone={<KeyRound className="size-4" aria-hidden />}
                label="Session"
                valeur="Jeton de 15 minutes, renouvelé par cookie sécurisé"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Périmètre d’accès"
              description="Un rôle peut être limité à une école ; sans école, il couvre tout le groupe."
            />
            <CardBody className="space-y-2">
              {user.roles.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Aucun rôle attribué : seules les pages publiques restent accessibles.
                </p>
              ) : (
                user.roles.map((role) => (
                  <div
                    key={`${role.code}-${role.ecole_id ?? 'all'}`}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] px-3 py-2"
                  >
                    <span className="text-sm font-medium">{libelleRole(role.code)}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {role.ecole_id ? `École #${role.ecole_id}` : 'Tout le groupe'}
                    </span>
                  </div>
                ))
              )}
              <p className="pt-2 text-xs text-[var(--muted-foreground)]">
                {possedeRole(user, 'DIRECTION')
                  ? 'Vous pouvez valider les délibérations, arrêtés de caisse et salaires.'
                  : 'Les actions de validation sont réservées à la direction.'}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

function Ligne({ icone, label, valeur }: { icone: React.ReactNode; label: string; valeur: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] pb-2 last:border-0 last:pb-0">
      <span className="text-[var(--muted-foreground)]">{icone}</span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
        <p className="truncate text-sm font-medium">{valeur}</p>
      </div>
    </div>
  )
}
