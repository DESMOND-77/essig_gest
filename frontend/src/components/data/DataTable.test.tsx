import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DataTable, type Column } from './DataTable'

interface Ligne {
  id: number
  nom: string
  montant: number
}

const colonnes: Column<Ligne>[] = [
  { key: 'nom', header: 'Étudiant', primary: true, render: (ligne) => ligne.nom },
  { key: 'montant', header: 'Montant', align: 'right', render: (ligne) => `${ligne.montant} FCFA` },
]

const lignes: Ligne[] = [
  { id: 1, nom: 'Alice MBOUROU', montant: 45000 },
  { id: 2, nom: 'Jean OBAME', montant: 30000 },
]

describe('DataTable', () => {
  it('affiche les en-têtes et les lignes', () => {
    render(
      <DataTable
        columns={colonnes}
        rows={lignes}
        rowKey={(l) => l.id}
        caption="Étudiants"
        mobileCards={false}
      />,
    )

    expect(screen.getByRole('columnheader', { name: 'Étudiant' })).toBeInTheDocument()
    expect(screen.getAllByText('Alice MBOUROU').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/45000 FCFA/).length).toBeGreaterThan(0)
  })

  it('affiche l’état vide quand aucune ligne ne correspond', () => {
    render(
      <DataTable
        columns={colonnes}
        rows={[]}
        rowKey={(l) => l.id}
        caption="Étudiants"
        emptyTitle="Aucun étudiant"
        emptyDescription="Ajustez la recherche."
      />,
    )

    expect(screen.getByText('Aucun étudiant')).toBeInTheDocument()
    expect(screen.getByText('Ajustez la recherche.')).toBeInTheDocument()
  })

  it('affiche l’erreur et permet de réessayer', () => {
    const onRetry = vi.fn()
    render(
      <DataTable
        columns={colonnes}
        rows={[]}
        rowKey={(l) => l.id}
        caption="Étudiants"
        error={new Error('Serveur indisponible')}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText('Serveur indisponible')).toBeInTheDocument()
    screen.getByRole('button', { name: /réessayer/i }).click()
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
