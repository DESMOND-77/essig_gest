export type PayloadErreur = Record<string, unknown> | { detail?: string } | null;

/** Extrait les erreurs de champ d'une réponse DRF 400 : { champ: ["msg", ...] }. */
export function champErreurs(payload: PayloadErreur): Record<string, string> {
  const out: Record<string, string> = {};
  if (payload && typeof payload === "object") {
    for (const [cle, val] of Object.entries(payload)) {
      if (cle === "detail") continue;
      out[cle] = Array.isArray(val) ? String(val[0]) : String(val);
    }
  }
  return out;
}

/** Message lisible pour un toast selon le statut HTTP. */
export function messageErreur(status: number, payload: PayloadErreur): string {
  const detail =
    payload && typeof payload === "object" && "detail" in payload
      ? String((payload as { detail?: unknown }).detail ?? "")
      : "";
  if (status === 401) return "Session expirée. Veuillez vous reconnecter.";
  if (status === 429) return detail || "Trop de requêtes. Réessayez dans un instant.";
  if (status === 403) return detail || "Rôle insuffisant pour cette action.";
  if (status === 409)
    return detail || "Suppression impossible : élément référencé ailleurs.";
  if (status === 404) return "Ressource introuvable.";
  if (status >= 500) return "Erreur serveur. Réessayez plus tard.";
  return detail || "Une erreur est survenue.";
}
