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
  const url = `/comptes/${query ? `?${query}` : ""}`;
  const response = await apiFetch(url);
  return jsonOuLeve(response);
}

/**
 * Obtenir un compte par son ID
 * @param id ID du compte
 * @returns Compte
 */
export async function obtenirCompte(id: number): Promise<any> {
  const response = await apiFetch(`/comptes/${id}/`);
  return jsonOuLeve(response);
}

/**
 * Créer un encaissement
 * @param data Données de l'encaissement à créer (sans ID ni champs générés par le serveur)
 * @returns Encaissement créé
 */
export async function creerEncaissement(data: any): Promise<any> {
  const response = await apiFetch(`/encaissements/`, {
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
  const response = await apiFetch(`/encaissements/${id}/`);
  return jsonOuLeve(response);
}

/**
 * Annuler un encaissement
 * @param id ID de l'encaissement à annuler
 */
export async function annulerEncaissement(id: number): Promise<void> {
  const response = await apiFetch(`/encaissements/${id}/annuler/`, {
    method: "POST",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors de l'annulation de l'encaissement ${id}: ${response.status}`
    );
  }
}

/**
 * Valider/comptabiliser un encaissement
 * @param id ID de l'encaissement à valider
 */
export async function validerEncaissement(id: number): Promise<void> {
  const response = await apiFetch(`/encaissements/${id}/valider/`, {
    method: "POST",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors de la validation de l'encaissement ${id}: ${response.status}`
    );
  }
}

/**
 * Obtenir un virement par son ID
 * @param id ID du virement
 * @returns Virement
 */
export async function obtenirVirement(id: number): Promise<any> {
  const response = await apiFetch(`/virements/${id}/`);
  return jsonOuLeve(response);
}

/**
 * Créer un virement (brouillon)
 * @param data Données du virement à créer
 * @returns Virement créé
 */
export async function creerVirement(data: any): Promise<any> {
  const response = await apiFetch(`/virements/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return jsonOuLeve(response);
}

/**
 * Engager un virement (passer de brouillon à engagé)
 * @param virementId ID du virement à engager
 */
export async function engagerVirement(virementId: number): Promise<void> {
  const response = await apiFetch(`/virements/${virementId}/engager/`, {
    method: "POST",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors de l'engagement du virement ${virementId}: ${response.status}`
    );
  }
}

/**
 * Valider un virement
 * @param virementId ID du virement à valider
 * @param valideParId Optionnel: ID de l'utilisateur validateur
 */
export async function validerVirement(virementId: number, valideParId?: number): Promise<any> {
  const body = valideParId !== undefined ? { valide_par_id: valideParId } : {};
  const response = await apiFetch(`/virements/${virementId}/valider/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors de la validation du virement ${virementId}: ${response.status}`
    );
  }
  return await response.json();
}

/**
 * Exécuter un virement (créer les mouvements comptables)
 * @param virementId ID du virement à exécuter
 */
export async function executerVirement(virementId: number): Promise<void> {
  const response = await apiFetch(`/virements/${virementId}/executer/`, {
    method: "POST",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors de l'exécution du virement ${virementId}: ${response.status}`
    );
  }
}

/**
 * Engager une dépense
 * @param data Données de la dépense à engager (statut sera mis à ENGAGEE)
 * @returns Dépense engagée
 */
export async function engagerDepense(data: any): Promise<any> {
  // Nous nous assurons que le statut est ENGAGEE pour l'engagement
  const dépenseData = { ...data, statut: 'ENGAGEE' };
  const response = await apiFetch(`/depenses/`, {
    method: "POST",
    body: JSON.stringify(dépenseData),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors de l'engagement de la dépense: ${response.status}`
    );
  }
  return await response.json();
}

/**
 * Valider une dépense engagée
 * @param dépenseId ID de la dépense à valider
 * @param valideParId Optionnel: ID de l'utilisateur validateur
 */
export async function validerDepense(dépenseId: number, valideParId?: number): Promise<any> {
  const body = valideParId !== undefined ? { valide_par_id: valideParId } : {};
  const response = await apiFetch(`/depenses/${dépenseId}/valider/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors de la validation de la dépense ${dépenseId}: ${response.status}`
    );
  }
  return await response.json();
}

/**
 * Payer une dépense
 * @param dépenseId ID de la dépense à payer
 * @returns Dépense payée
 */
export async function payerDepense(dépenseId: number): Promise<any> {
  const response = await apiFetch(`/depenses/${dépenseId}/payer/`, {
    method: "POST",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors du paiement de la dépense ${dépenseId}: ${response.status}`
    );
  }
  return await response.json();
}

/**
 * Annuler une dépense
 * @param dépenseId ID de la dépense à annuler
 */
export async function annulerDepense(dépenseId: number): Promise<void> {
  const response = await apiFetch(`/depenses/${dépenseId}/annuler/`, {
    method: "POST",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors de l'annulation de la dépense ${dépenseId}: ${response.status}`
    );
  }
}

/**
 * Obtenir le solde théorique d'une caisse à une date donnée
 * @param compteId ID du compte de caisse
 * @param dateLaDate Date pour laquelle calculer le solde théorique (format: AAAA-MM-JJ)
 * @returns Solde théorique en FCFA
 */
export async function obtenirSoldeTheoriqueCaisse(compteId: number, dateLaDate: string): Promise<number> {
  const response = await apiFetch(`/tableau-de-bord/solde-theorique/?compte_id=${compteId}&date=${dateLaDate}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors du calcul du solde théorique de la caisse ${compteId}: ${response.status}`
    );
  }
  const data = await response.json();
  // Assuming the API returns { solde_theorique: number }
  return data.solde_theorique;
}

/**
 * Créer un arrêté de caisse
 * @param data Données de l'arrêté à créer
 * @returns Arrêté de caisse créé
 */
export async function creerArreteCaisse(data: any): Promise<any> {
  const response = await apiFetch(`/arretes-caisse/`, {
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
  const response = await apiFetch(`/arretes-caisse/${arreteId}/valider/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors de la validation de l'arrêté de caisse ${arreteId}: ${response.status}`
    );
  }
  return await response.json();
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
  const response = await apiFetch(`/arretes-caisse/${arreteId}/billetage/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors de l'enregistrement du billetage batch pour l'arrêté ${arreteId}: ${response.status}`
    );
  }
  return await response.json();
}

/**
 * Obtenir les données du tableau de bord trésorerie
 * @returns Données du tableau de bord (soldes, flux, récents, etc.)
 */
export async function obtenirTableauBordTresorerie(): Promise<any> {
  // Nous pourrions appeler plusieurs endpoints et agréger les résultats,
  // mais pour simplifier, nous supposons qu'il existe un endpoint global.
  // Sinon, nous pouvons appeler chaque endpoint séparément et combiner.
  // Ici, nous appelons un endpoint hypothétique qui renvoie tout.
  // Si tel n'existe pas, nous devrons appeler chaque endpoint individuellement.
  // Pour l'instant, nous retournons un objet vide et laisserons l'appelant gérer.
  // Une meilleure approche serait d'appeler les endpoints connus et de retourner un objet agrégé.
  // Nous implémenterons une version qui appelle plusieurs endpoints.
  try {
    const [
      soldeParType,
      soldeParCompte,
      flux,
      encaissementsRecents,
      depensesRecentes,
      ecartsCaisse,
      previsionnel
    ] = await Promise.all([
      apiFetch(`/tableau-de-bord/solde/`).then(jsonOuLeve),
      apiFetch(`/tableau-de-bord/solde-par-compte/`).then(jsonOuLeve),
      apiFetch(`/tableau-de-bord/flux/`).then(jsonOuLeve),
      apiFetch(`/tableau-de-bord/encaissements-recents/`).then(jsonOuLeve),
      apiFetch(`/tableau-de-bord/depenses-recentes/`).then(jsonOuLeve),
      apiFetch(`/tableau-de-bord/ecarts-caisse/`).then(jsonOuLeve),
      apiFetch(`/tableau-de-bord/previsionnel/`).then(jsonOuLeve),
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
  } catch (error) {
    throw new Error(`Erreur lors de la récupération du tableau de bord: ${error.message}`);
  }
}

/**
 * Calcule le reste à payer pour une inscription donnée (fonction héritée de la phase 4)
 * @param inscriptionId L'ID de l'inscription
 * @returns Le reste à payer en FCFA (nombre entier)
 */
export async function calculerResteDuInscription(inscriptionId: number): Promise<number> {
  const response = await apiFetch(`/scolarite/inscriptions/${inscriptionId}/reste-a-payer/`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail ||
      `Erreur lors du calcul du reste à payer pour l'inscription ${inscriptionId}: ${response.status}`
    );
  }
  const data = await response.json();
  // Assuming the API returns { reste_a_payer: number }
  return data.reste_a_payer;
}