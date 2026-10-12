import { engagerDepense, validerDepense, payerDepense, annulerDepense } from '../../../lib/tresorerie';

/**
 * Actions spécifiques pour les dépenses
 */
export const DepenseActions = {
  /**
   * Engager une dépense
   * @param data Les données de la dépense à engager
   */
  async engagerDepense(data: any): Promise<any> {
    return await engagerDepense(data);
  },

  /**
   * Valider une dépense engagée
   * @param dépenseId L'ID de la dépense à valider
   * @param valideParId Optionnel: ID de l'utilisateur validateur
   */
  async validerDepense(dépenseId: number, valideParId?: number): Promise<void> {
    await validerDepense(dépenseId, valideParId);
  },

  /**
   * Payer une dépense
   * @param dépenseId L'ID de la dépense à payer
   */
  async payerDepense(dépenseId: number): Promise<void> {
    await payerDepense(dépenseId);
  },

  /**
   * Annuler une dépense
   * @param dépenseId L'ID de la dépense à annuler
   */
  async annulerDepense(dépenseId: number): Promise<void> {
    await annulerDepense(dépenseId);
  }
};