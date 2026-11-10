import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginPage } from './LoginPage'

const connexion = vi.fn()

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ connexion, statut: 'anonyme' }),
}))

function afficher() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    connexion.mockReset()
  })

  it('valide la présence des deux champs', async () => {
    const utilisateur = userEvent.setup()
    afficher()

    await utilisateur.click(screen.getByRole('button', { name: /se connecter/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Renseignez votre identifiant et votre mot de passe.',
    )
    expect(connexion).not.toHaveBeenCalled()
  })

  it('transmet l’identifiant et le mot de passe', async () => {
    const utilisateur = userEvent.setup()
    connexion.mockResolvedValue({ login: 'alice' })
    afficher()

    await utilisateur.type(screen.getByLabelText(/^Identifiant/), 'alice')
    await utilisateur.type(screen.getByLabelText(/^Mot de passe/), 'secret123')
    await utilisateur.click(screen.getByRole('button', { name: /se connecter/i }))

    expect(connexion).toHaveBeenCalledWith('alice', 'secret123')
  })

  it('affiche un message explicite sur identifiants invalides', async () => {
    const utilisateur = userEvent.setup()
    const { ApiError } = await import('@/lib/http')
    connexion.mockRejectedValue(new ApiError(401, { detail: 'Identifiants invalides' }))
    afficher()

    await utilisateur.type(screen.getByLabelText(/^Identifiant/), 'alice')
    await utilisateur.type(screen.getByLabelText(/^Mot de passe/), 'mauvais')
    await utilisateur.click(screen.getByRole('button', { name: /se connecter/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Identifiant ou mot de passe incorrect.',
    )
  })
})
