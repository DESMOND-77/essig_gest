import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from './AppProviders'
import { AppRoutes } from '@/routes'

/**
 * Test d'intégration du chemin critique : un visiteur sans session valide doit
 * arriver sur l'écran de connexion, sans écran blanc ni erreur de rendu.
 */
describe('AppRoutes', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'Non authentifié' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirige un visiteur anonyme vers la connexion', async () => {
    render(
      <AppProviders>
        <AppRoutes />
      </AppProviders>,
    )

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Identifiant/)).toBeInTheDocument()
  })
})
