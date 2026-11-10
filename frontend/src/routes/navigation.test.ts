import { describe, expect, it } from 'vitest'

import { sectionsVisibles, titreDeRoute } from './navigation'
import type { Utilisateur } from '@/lib/types'

function utilisateur(...codes: string[]): Utilisateur {
  return {
    id: 1,
    login: 'test.user',
    email: 'test@essig.ga',
    roles: codes.map((code, index) => ({ code, ecole_id: index === 0 ? null : 2 })),
    doit_changer_mot_de_passe: false,
  } as unknown as Utilisateur
}

describe('navigation', () => {
  it('donne accès en lecture aux finances au profil scolarité', () => {
    const sections = sectionsVisibles(utilisateur('SCOLARITE'))
    expect(sections.map((section) => section.id)).toEqual([
      'pilotage',
      'scolarite',
      'pedagogie',
      'finances',
      'rh',
    ])
  })

  it('limite un compte sans rôle aux modules de base', () => {
    const sections = sectionsVisibles(utilisateur())
    expect(sections.map((section) => section.id)).toEqual(['pilotage', 'scolarite', 'pedagogie'])
  })

  it('affiche les finances et la paie aux profils comptables', () => {
    const sections = sectionsVisibles(utilisateur('COMPTABLE'))
    const ids = sections.map((section) => section.id)
    expect(ids).toContain('finances')
    expect(ids).toContain('rh')
  })

  it('résout le libellé de la route la plus spécifique', () => {
    expect(titreDeRoute('/scolarite/bourses')).toBe('Bourses')
    expect(titreDeRoute('/etudiants')).toBe('Étudiants')
    expect(titreDeRoute('/inconnue')).toBe('ESSIG Gest')
  })
})
