import type { components, operations, paths } from "./schema";

export type { components, operations, paths };

/**
 * Réponse de `GET /api/v1/auth/moi/`.
 *
 * Le schéma OpenAPI généré ne décrit pas le corps de cette réponse
 * (les vues d'auth sont des `APIView` sans `serializer_class`, donc
 * drf-spectacular les expose en « No response body » et `components.schemas`
 * vaut `never`). On décrit donc ici la forme réelle renvoyée par
 * `comptes.serializers.MoiSerializer`. À remplacer par
 * `components["schemas"][...]` dès que le backend annote la vue.
 */
export interface MoiRoleAttribution {
  code: string;
  ecole_id: number | null;
}

export interface MoiReponse {
  id: number;
  login: string;
  email: string;
  roles: MoiRoleAttribution[];
}
