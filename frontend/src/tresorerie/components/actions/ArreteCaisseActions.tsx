import { creerArreteCaisse, validerArreteCaisse } from '../../../lib/tresorerie';

/**
 * Actions spécifiques pour les arrêtés de caisse
 */
export const ArreteCaisseActions = {
  /**
   * Créer un arrêté de caisse
   * @param data Les données de l'arrêté à créer
   */
  async creerArreteCaisse(data: any): Promise<any> {
    return await creerArreteCaisse(data);
  },

  /**
   * Valider un arrêté de caisse après vérification du billetage
   * @param arreteId L'ID de l'arrêté de caisse à valider
   * @param valideParId Optionnel: ID de l'utilisateur validateur
   */
  async validerArreteCaisse(arreteId: number, valideParId?: number): Promise<void> {
    await validerArreteCaisse(arreteId, valideParId);
  }
};