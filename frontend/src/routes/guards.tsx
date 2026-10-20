import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/AuthProvider'
import { LoadingState } from '@/components/ui/States'
import type { RoleCode } from '@/lib/types'
import { possedeRole } from '@/auth/permissions'

export function RequireAuth() {
  const { statut } = useAuth()
  const location = useLocation()

  if (statut === 'chargement') {
    return (
      <div className="grid min-h-dvh place-items-center">
        <LoadingState label="Ouverture de la session…" />
      </div>
    )
  }
  if (statut === 'anonyme') {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function RequireRole({ roles, children }: { roles: RoleCode[]; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!possedeRole(user, ...roles)) {
    return <Navigate to="/non-autorise" replace />
  }
  return <>{children}</>
}
