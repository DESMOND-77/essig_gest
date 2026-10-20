import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import logoFull from '@/assets/logos/essig-logo.png'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/FormField'
import { useAuth } from '@/auth/AuthProvider'
import { ApiError } from '@/lib/http'

export function LoginPage() {
  const { connexion, statut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [champs, setChamps] = useState<Record<string, string[]>>({})

  const destination =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from?: string }).from !== '/connexion'
      ? (location.state as { from: string }).from
      : '/'

  if (statut === 'authentifie') {
    return <Navigate to={destination} replace />
  }

  const soumettre = async (event: React.FormEvent) => {
    event.preventDefault()
    setErreur(null)
    setChamps({})

    if (!login.trim() || !password) {
      setErreur('Renseignez votre identifiant et votre mot de passe.')
      return
    }

    setEnCours(true)
    try {
      await connexion(login.trim(), password)
      navigate(destination, { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 429) {
          setErreur('Trop de tentatives. Patientez une minute avant de réessayer.')
        } else if (error.status === 401) {
          setErreur('Identifiant ou mot de passe incorrect.')
        } else {
          setErreur(error.message)
        }
        setChamps(error.fields ?? {})
      } else {
        setErreur('Connexion au serveur impossible. Vérifiez votre réseau.')
      }
    } finally {
      setEnCours(false)
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Panneau institutionnel */}
      <section className="relative hidden overflow-hidden bg-[var(--sidebar)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(90% 70% at 10% 0%, rgba(7,157,211,0.35) 0%, transparent 60%), radial-gradient(70% 60% at 100% 100%, rgba(173,112,31,0.22) 0%, transparent 60%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <span className="grid size-12 place-items-center overflow-hidden rounded-2xl bg-white">
            <img src={logoFull} alt="" width={48} height={48} className="size-12 object-contain" />
          </span>
          <div>
            <p className="text-base font-bold tracking-wide">ESSIG Gest</p>
            <p className="text-xs text-[var(--sidebar-muted)]">Gestion scolaire intégrée</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl leading-tight font-bold text-balance">
            Pilotez la scolarité, les finances et la pédagogie depuis un seul poste de travail.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[var(--sidebar-muted)]">
            Inscriptions et pièces de dossier, échéanciers et encaissements, notes et délibérations,
            trésorerie et paie : chaque opération est tracée, contrôlée et validée par le rôle
            habilité.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-[var(--sidebar-muted)]">
            <li>• Caisse, banque et Mobile Money consolidés</li>
            <li>• Bulletins et reçus générés en PDF</li>
            <li>• Contrôles serveur sur chaque montant</li>
          </ul>
        </div>

        <p className="relative text-xs text-[var(--sidebar-muted)]">
          Groupe ESSIG · Libreville, Gabon · {new Date().getFullYear()}
        </p>
      </section>

      {/* Formulaire */}
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <span className="grid size-16 place-items-center overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card)]">
              <img src={logoFull} alt="ESSIG Gest" width={64} height={64} className="size-16 object-contain" />
            </span>
            <h1 className="mt-3 text-lg font-bold">ESSIG Gest</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Gestion scolaire intégrée</p>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Connexion</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Utilisez les identifiants fournis par l’administration.
          </p>

          <form onSubmit={soumettre} className="mt-6 space-y-4" noValidate>
            {erreur ? (
              <div
                role="alert"
                className="rounded-[var(--radius-control)] border border-[var(--destructive)]/30 bg-[var(--destructive-subtle)] px-3 py-2.5 text-sm text-[var(--destructive)]"
              >
                {erreur}
              </div>
            ) : null}

            <InputField
              label="Identifiant"
              name="login"
              autoComplete="username"
              autoFocus
              required
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              error={champs.login?.join(' ')}
              placeholder="prenom.nom"
            />

            <div className="relative">
              <InputField
                label="Mot de passe"
                name="password"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={champs.password?.join(' ')}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute top-[30px] right-1 grid size-9 place-items-center rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={enCours}
              icon={<LogIn className="size-4" aria-hidden />}
            >
              Se connecter
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
            Session sécurisée · jetons de 15 minutes renouvelés automatiquement
          </p>
        </div>
      </section>
    </main>
  )
}
