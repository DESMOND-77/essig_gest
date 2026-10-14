import { apiFetch } from "../api/client";

type ParamsListe = Record<string, string | number | undefined>;

async function jsonOuLeve(resp: Response) {
  const corps = resp.status === 204 ? null : await resp.json().catch(() => null);
  if (!resp.ok) {
    throw Object.assign(new Error(`HTTP ${resp.status}`), {
      status: resp.status,
      payload: corps,
    });
  }
  return corps;
}

/**
 * Liste les comptes avec filtrage et pagination
 * @param params Paramètres de filtrage (optionnel)
 * @returns Page de comptes
 */
export async function listerComptes(params: ParamsListe = {}): Promise<any> {
  const queryString = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      queryString.set(k, String(v));
    }
  }
  const query = queryString.toString();
  const url = `/tresorerie/comptes/${query ? `?${query}` : ""}`;
  const response = await apiFetch(url);
  return jsonOuLeve(response);
}

/**
 * Obtenir un compte par son ID
 * @param id ID du compte
 * @returns Compte
 */
export async function obtenirCompte(id: number): Promise<any> {
  const response = await apiFetch(`/tresorerie/comptes/${id}/`);
  return jsonOuLeve(response);
}

/**
 * Créer un encaissement
 * @param data Données de l'encaissement à créer (sans ID ni champs générés par le serveur)
 * @returns Encaissement créé
 */
export async function creerEncaissement(data: any): Promise<any> {
  const response = await apiFetch(`/tresorerie/encaissements/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return jsonOuLeve(response);
}

/**
 * Obtenir un encaissement par son ID
 * @param id ID de l'encaissement
 * @returns Encaissement
 */
export async function obtenirEncaissement(id: number): Promise<any> {
  const response = await apiFetch(`/tresorerie/encaissements/${id}/`);
  return jsonOuLeve(response);
}

/**
 * Annuler un encaissement
 * @param id ID de l'encaissement à annuler
 */
export async function annulerEncaissement(id: number): Promise<any> {
  const response = await apiFetch(`/tresorerie/encaissements/${id}/annuler/`, {
    method: "POST",
  });
  return jsonOuLeve(response);
}

/**
 * Valider/comptabiliser un encaissement
 * @param id ID de l'encaissement à valider
 */
export async function validerEncaissement(id: number): Promise<any> {
  const response = await apiFetch(`/tresorerie/encaissements/${id}/valider/`, {
    method: "POST",
  });
  return jsonOuLeve(response);
}

/**
 * Obtenir un virement par son ID
 * @param id ID du virement
 * @returns Virement
 */
export async function obtenirVirement(id: number): Promise<any> {
  const response = await apiFetch(`/tresorerie/virements/${id}/`);
  return jsonOuLeve(response);
}

/**
 * Créer un virement (brouillon)
 * @param data Données du virement à créer
 * @returns Virement créé
 */
export async function creerVirement(data: any): Promise<any> {
  const response = await apiFetch(`/tresorerie/virements/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return jsonOuLeve(response);
}

/**
 * Engager un virement (passer de BROUILLON à EN_ATTENTE_VALIDATION, étape "maker")
 * @param virementId ID du virement à engager
 */
export async function engagerVirement(virementId: number): Promise<any> {
  const response = await apiFetch(`/tresorerie/virements/${virementId}/engager/`, {
    method: "POST",
  });
  return jsonOuLeve(response);
}

/**
 * Valider un virement en attente de validation (étape "checker") : crée les deux mouvements
 * comptables et passe le statut à VALIDE. Il n'existe pas d'étape "exécuter" distincte : la
 * validation est l'étape qui pose les écritures.
 * @param virementId ID du virement à valider
 * @param valideParId Optionnel: ID de l'utilisateur validateur
 */
export async function validerVirement(virementId: number, valideParId?: number): Promise<any> {
  const body = valideParId !== undefined ? { valide_par_id: valideParId } : {};
  const response = await apiFetch(`/tresorerie/virements/${virementId}/valider/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return jsonOuLeve(response);
}

/**
 * Annuler un virement (depuis BROUILLON, EN_ATTENTE_VALIDATION ou VALIDE). Si le virement était
 * déjà VALIDE, le backend crée une contre-écriture ; sinon aucun mouvement n'existait encore.
 * @param virementId ID du virement à annuler
 */
export async function annulerVirement(virementId: number): Promise<any> {
  const response = await apiFetch(`/tresorerie/virements/${virementId}/annuler/`, {
    method: "POST",
  });
  return jsonOuLeve(response);
}

/**
 * Engager une dépense
 * @param data Données de la dépense à engager
 * @returns Dépense engagée
 */
export async function engagerDepense(data: any): Promise<any> {
  // `statut` n'est jamais envoyé : le backend l'impose (ENGAGEE par défaut à la création).
  const response = await apiFetch(`/tresorerie/depenses/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return jsonOuLeve(response);
}

/**
 * Valider une dépense engagée
 * @param dépenseId ID de la dépense à valider
 * @param valideParId Optionnel: ID de l'utilisateur validateur
 */
export async function validerDepense(dépenseId: number, valideParId?: number): Promise<any> {
  const body = valideParId !== undefined ? { valide_par_id: valideParId } : {};
  const response = await apiFetch(`/tresorerie/depenses/${dépenseId}/valider/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return jsonOuLeve(response);
}

/**
 * Payer une dépense
 * @param dépenseId ID de la dépense à payer
 * @returns Dépense payée
 */
export async function payerDepense(dépenseId: number): Promise<any> {
  const response = await apiFetch(`/tresorerie/depenses/${dépenseId}/payer/`, {
    method: "POST",
  });
  return jsonOuLeve(response);
}

/**
 * Annuler une dépense
 * @param dépenseId ID de la dépense à annuler
 */
export async function annulerDepense(dépenseId: number): Promise<any> {
  const response = await apiFetch(`/tresorerie/depenses/${dépenseId}/annuler/`, {
    method: "POST",
  });
  return jsonOuLeve(response);
}

/**
 * Obtenir le solde théorique d'une caisse à une date donnée (prévisualisation avant de créer
 * un arrêté de caisse — le backend refait le même calcul à la création).
 * @param compteId ID du compte de caisse
 * @param dateLaDate Date pour laquelle calculer le solde théorique (format: AAAA-MM-JJ)
 * @returns Solde théorique en FCFA
 */
export async function obtenirSoldeTheoriqueCaisse(compteId: number, dateLaDate: string): Promise<number> {
  const response = await apiFetch(
    `/tresorerie/arretes-caisse/solde-theorique/?compte_id=${compteId}&date=${dateLaDate}`
  );
  const data = await jsonOuLeve(response);
  return data.solde_theorique;
}

/**
 * Créer un arrêté de caisse
 * @param data Données de l'arrêté à créer
 * @returns Arrêté de caisse créé
 */
export async function creerArreteCaisse(data: any): Promise<any> {
  const response = await apiFetch(`/tresorerie/arretes-caisse/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return jsonOuLeve(response);
}

/**
 * Valider un arrêté de caisse après vérification du billetage
 * @param arreteId ID de l'arrêté de caisse à valider
 * @param valideParId Optionnel: ID de l'utilisateur validateur
 */
export async function validerArreteCaisse(arreteId: number, valideParId?: number): Promise<any> {
  const body = valideParId !== undefined ? { valide_par_id: valideParId } : {};
  const response = await apiFetch(`/tresorerie/arretes-caisse/${arreteId}/valider/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return jsonOuLeve(response);
}

/**
 * Enregistrer un lot de lignes de billetage pour un arrêté de caisse (opération atomique)
 * @param arreteId ID de l'arrêté de caisse
 * @param lignes Array de lignes { denomination, quantite }
 * @returns Object contenant les lignes créées et le total
 */
export async function enregistrerBilletageBatch(
  arreteId: number,
  lignes: { denomination: number; quantite: number }[]
): Promise<any> {
  const body = { lignes };
  const response = await apiFetch(`/tresorerie/arretes-caisse/${arreteId}/billetage_batch/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return jsonOuLeve(response);
}

/**
 * Obtenir les données du tableau de bord trésorerie (agrège les 7 endpoints de lecture).
 * @returns Données du tableau de bord (soldes, flux, récents, écarts, prévisionnel)
 */
export async function obtenirTableauBordTresorerie(): Promise<any> {
  const [
    soldeParType,
    soldeParCompte,
    flux,
    encaissementsRecents,
    depensesRecentes,
    ecartsCaisse,
    previsionnel,
  ] = await Promise.all([
    apiFetch(`/tresorerie/tableau-de-bord/solde/`).then(jsonOuLeve),
    apiFetch(`/tresorerie/tableau-de-bord/solde-par-compte/`).then(jsonOuLeve),
    apiFetch(`/tresorerie/tableau-de-bord/flux/`).then(jsonOuLeve),
    apiFetch(`/tresorerie/tableau-de-bord/encaissements-recents/`).then(jsonOuLeve),
    apiFetch(`/tresorerie/tableau-de-bord/depenses-recentes/`).then(jsonOuLeve),
    apiFetch(`/tresorerie/tableau-de-bord/ecarts-caisse/`).then(jsonOuLeve),
    apiFetch(`/tresorerie/tableau-de-bord/previsionnel/`).then(jsonOuLeve),
  ]);
  return {
    soldeParType,
    soldeParCompte,
    flux,
    encaissementsRecents,
    depensesRecentes,
    ecartsCaisse,
    previsionnel,
  };
}

/**
 * Calcule le reste à payer pour une inscription donnée (affichage informatif avant encaissement ;
 * le backend recalcule et contrôle de toute façon au moment de l'imputation réelle).
 * @param inscriptionId L'ID de l'inscription
 * @returns Le reste à payer en FCFA (nombre entier)
 */
export async function calculerResteDuInscription(inscriptionId: number): Promise<number> {
  const response = await apiFetch(`/personnes/inscriptions/${inscriptionId}/reste-a-payer/`);
  const data = await jsonOuLeve(response);
  return data.reste_a_payer;
}
