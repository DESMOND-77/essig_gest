import { creerVirement, engagerVirement, validerVirement, annulerVirement } from '../../../lib/tresorerie';

/**
 * Actions spécifiques pour les virements
 */
export const VirementActions = {
  /**
   * Créer un virement (brouillon)
   * @param data Données du virement à créer
   */
  async creerVirement(data: any): Promise<any> {
    return await creerVirement(data);
  },

  /**
   * Engager un virement (passer de brouillon à engagé)
   * @param virementId L'ID du virement à engager
   */
  async engagerVirement(virementId: number): Promise<void> {
    await engagerVirement(virementId);
  },

  /**
   * Valider un virement
   * @param virementId L'ID du virement à valider
   * @param valideParId Optionnel: ID de l'utilisateur validateur
   */
  async validerVirement(virementId: number, valideParId?: number): Promise<void> {
    await validerVirement(virementId, valideParId);
  },

  /**
   * Annuler un virement
   * @param virementId L'ID du virement à annuler
   */
  async annulerVirement(virementId: number): Promise<void> {
    await annulerVirement(virementId);
  }
};