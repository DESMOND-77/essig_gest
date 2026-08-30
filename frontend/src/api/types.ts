import type { components, operations, paths } from "./schema";

export type { components, operations, paths };

/**
 * Réponse de `GET /api/v1/auth/moi/`.
 *
 * Type issu du schéma OpenAPI généré (`comptes.serializers.MoiSerializer`,
 * annoté via `@extend_schema`). Toute dérive du backend casse désormais
 * `types.test-d.ts`.
 */
export type MoiReponse = components["schemas"]["Moi"];
