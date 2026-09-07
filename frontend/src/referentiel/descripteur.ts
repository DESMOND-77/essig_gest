import type { ZodTypeAny } from "zod";

export type Champ = {
  nom: string;
  label: string;
  type: "text" | "number" | "checkbox" | "select" | "fk";
  requis?: boolean;
  options?: { valeur: string; label: string }[];
  fkEndpoint?: string;
  fkLabel?: (o: Record<string, unknown>) => string;
  aide?: string;
  /** Rendu seulement en création (masqué quand `valeurs` est fourni à `ResourceForm`). */
  creationSeule?: boolean;
};

export type Colonne = {
  cle: string;
  entete: string;
  rendu?: (ligne: Record<string, unknown>) => string;
};

export type Descripteur<T extends { id: number } = { id: number }> = {
  titre: string;
  endpoint: string; // ex. "referentiel/ecoles"
  roleEcriture: string[]; // ["DIRECTION"] ou ["DIRECTION","SCOLARITE"]
  colonnes: Colonne[];
  champs: Champ[];
  schema: ZodTypeAny;
  triDefaut?: string;
  filtres?: { nom: string; label: string; fkEndpoint?: string; options?: { valeur: string; label: string }[] }[];
  rechercheActive?: boolean;
  _t?: T;
};

export function peutEcrire(roles: { code: string }[], requis: string[]): boolean {
  const codes = new Set(roles.map((r) => r.code));
  return requis.some((r) => codes.has(r));
}
