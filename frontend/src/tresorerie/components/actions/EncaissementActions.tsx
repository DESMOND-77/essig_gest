import { validerEncaissement, annulerEncaissement } from '../../../lib/tresorerie';

/**
 * Actions spécifiques pour les encaissements
 */
export const EncaissementActions = {
  /**
   * Valider/comptabiliser un encaissement
   * @param id L'ID de l'encaissement à valider
   */
  async validerEncaissement(id: number): Promise<void> {
    await validerEncaissement(id);
  },

  /**
   * Annuler un encaissement
   * @param id L'ID de l'encaissement à annuler
   */
  async annulerEncaissement(id: number): Promise<void> {
    await annulerEncaissement(id);
  }
};