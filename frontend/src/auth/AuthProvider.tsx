import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  api,
  EVENEMENT_SESSION_EXPIREE,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from '@/lib/http'
import type { Utilisateur } from '@/lib/types'

interface AuthContextValue {
  user: Utilisateur | null
  /** `chargement` tant que la session n'a pas été résolue (cookie refresh). */
  statut: 'chargement' | 'authentifie' | 'anonyme'
  connexion: (login: string, password: string) => Promise<Utilisateur>
  deconnexion: () => Promise<void>
  rafraichirProfil: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Utilisateur | null>(null)
  const [statut, setStatut] = useState<AuthContextValue['statut']>('chargement')
  const queryClient = useQueryClient()
  const monte = useRef(true)

  useEffect(() => {
    monte.current = true
    return () => {
      monte.current = false
    }
  }, [])

  const chargerProfil = useCallback(async () => {
    const profil = await api.get<Utilisateur>('/api/v1/auth/moi/')
    if (monte.current) setUser(profil)
    return profil
  }, [])

  // Au démarrage : si un access token est présent, on valide la session ;
  // sinon on tente un refresh silencieux via le cookie httpOnly.
  useEffect(() => {
    let annule = false
    ;(async () => {
      try {
        if (!getAccessToken()) {
          const token = await refreshAccessToken()
          if (!token) {
            if (!annule) setStatut('anonyme')
            return
          }
        }
        const profil = await api.get<Utilisateur>('/api/v1/auth/moi/')
        if (!annule) {
          setUser(profil)
          setStatut('authentifie')
        }
      } catch {
        setAccessToken(null)
        if (!annule) {
          setUser(null)
          setStatut('anonyme')
        }
      }
    })()
    return () => {
      annule = true
    }
  }, [])

  // Expiration en cours d'usage : le rafraîchissement a échoué côté `http.ts`.
  useEffect(() => {
    const onExpiration = () => {
      setUser(null)
      setStatut('anonyme')
      queryClient.clear()
    }
    window.addEventListener(EVENEMENT_SESSION_EXPIREE, onExpiration)
    return () => window.removeEventListener(EVENEMENT_SESSION_EXPIREE, onExpiration)
  }, [queryClient])

  const connexion = useCallback(
    async (login: string, password: string) => {
      const { access } = await api.post<{ access: string }>(
        '/api/v1/auth/login/',
        { login, password },
        { auth: false },
      )
      setAccessToken(access)
      const profil = await chargerProfil()
      queryClient.clear()
      setStatut('authentifie')
      return profil
    },
    [chargerProfil, queryClient],
  )

  const deconnexion = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout/', undefined, { auth: false })
    } catch {
      /* Le jeton local est effacé quoi qu'il arrive. */
    }
    setAccessToken(null)
    setUser(null)
    setStatut('anonyme')
    queryClient.clear()
  }, [queryClient])

  const rafraichirProfil = useCallback(async () => {
    try {
      await chargerProfil()
    } catch {
      /* profil indisponible : on conserve l'état courant */
    }
  }, [chargerProfil])

  const value = useMemo<AuthContextValue>(
    () => ({ user, statut, connexion, deconnexion, rafraichirProfil }),
    [user, statut, connexion, deconnexion, rafraichirProfil],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé sous <AuthProvider>')
  return context
}
