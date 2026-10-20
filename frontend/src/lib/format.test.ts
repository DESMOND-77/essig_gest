import { describe, expect, it } from 'vitest'

import { dateCourte, decimal, fcfa, initiales, nomComplet, pourcentage } from './format'

describe('formatage FCFA', () => {
  it('sépare les milliers selon la locale fr-FR', () => {
    expect(fcfa(1250000).replace(/\u202f|\u00a0/g, ' ')).toBe('1 250 000 FCFA')
  })

  it('accepte les montants renvoyés en chaîne par l’API', () => {
    expect(fcfa('45000.00').replace(/\u202f|\u00a0/g, ' ')).toBe('45 000 FCFA')
  })

  it('affiche un tiret pour une valeur absente', () => {
    expect(fcfa(null)).toBe('—')
    expect(fcfa(undefined)).toBe('—')
  })
})

describe('nombres et pourcentages', () => {
  it('formate deux décimales', () => {
    expect(decimal('12.5').replace(/\u202f|\u00a0/g, ' ')).toBe('12,50')
  })

  it('ajoute le symbole pourcent', () => {
    expect(pourcentage(33.333)).toBe('33,33 %')
  })
})

describe('dates et identités', () => {
  it('formate une date ISO courte sans décalage de fuseau', () => {
    expect(dateCourte('2025-10-01')).toBe('01/10/2025')
  })

  it('construit les initiales', () => {
    expect(initiales('OBAME', 'Jean')).toBe('OJ')
    expect(initiales('', '')).toBe('?')
  })

  it('compose le nom complet', () => {
    expect(nomComplet({ nom: 'MBOUROU', prenoms: 'Alice' })).toBe('MBOUROU Alice')
  })
})
