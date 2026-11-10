import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TableauDeBordPage } from './TableauDeBordPage'

const get = vi.fn()

vi.mock('@/lib/http', () => ({
  api: { get: (...args: unknown[]) => get(...args) },
}))

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 1, login: 'direction', email: null, roles: [{ code: 'DIRECTION', ecole_id: null }] },
  }),
}))

const donnees = {
  annee_scolaire_id: 3,
  annee_scolaire_libelle: '2025-2026',
  etudiants_inscrits: 412,
  encaissements: 125000000,
  reste_a_recouvrer: 45000000,
  depenses: 38000000,
  solde_comptes: 92000000,
  masse_salariale: 21000000,
  resultats_par_decision: { ADMIS: 300, REDOUBLE: 40, ADMIS_CONDITIONNEL: 12 },
  alertes: { echeances_en_retard: 27, arretes_caisse_en_ecart: 2 },
}

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TableauDeBordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TableauDeBordPage', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue(donnees)
  })

  it('affiche les indicateurs de l’année courante', async () => {
    afficher()

    expect(await screen.findByText('Admis')).toBeInTheDocument()
    expect(screen.getAllByText(/Étudiants inscrits/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^125.*000 FCFA$/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^45.*000 FCFA$/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('2025-2026').length).toBeGreaterThan(0)
  })

  it('ventile les décisions et les alertes', async () => {
    afficher()

    expect(await screen.findByText('Admis')).toBeInTheDocument()
    expect(screen.getByText('Redouble')).toBeInTheDocument()
    expect(screen.getByText('27')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
