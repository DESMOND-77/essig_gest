import { TRESORERIE as T } from '@/api/endpoints'
import { useAll } from '@/lib/hooks'
import type {
  ArreteCaisse,
  CategorieMouvement,
  Compte,
  Depense,
  Encaissement,
  Virement,
} from '@/lib/types'

export { TRESORERIE as T } from '@/api/endpoints'

export function useComptes() {
  return useAll<Compte>(T.comptes, { actif: 'true' })
}

export function useCategories(sens?: 'ENTREE' | 'SORTIE') {
  return useAll<CategorieMouvement>(T.categories, sens ? { sens } : undefined)
}

export function useEncaissements(params?: Record<string, unknown>) {
  return useAll<Encaissement>(T.encaissements, params as never)
}

export function useDepenses(params?: Record<string, unknown>) {
  return useAll<Depense>(T.depenses, params as never)
}

export function useVirements() {
  return useAll<Virement>(T.virements)
}

export function useArretes() {
  return useAll<ArreteCaisse>(T.arretes)
}

export const libelleTypeCompte: Record<string, string> = {
  CAISSE: 'Caisse',
  BANQUE: 'Banque',
  MOBILE_MONEY: 'Mobile Money',
  VIRTUEL: 'Virtuel',
}

export const libelleMode: Record<string, string> = {
  ESPECES: 'Espèces',
  VIREMENT: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
  CHEQUE: 'Chèque',
}

export const libelleStatutEncaissement: Record<string, string> = {
  EN_COURS: 'En cours',
  VALIDE: 'Validé',
  ANNULE: 'Annulé',
}

export const libelleStatutDepense: Record<string, string> = {
  ENGAGEE: 'Engagée',
  VALIDEE: 'Validée',
  PAYEE: 'Payée',
  ANNULEE: 'Annulée',
}

export const libelleStatutVirement: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_VALIDATION: 'En attente de validation',
  VALIDE: 'Validé',
  ANNULE: 'Annulé',
}
