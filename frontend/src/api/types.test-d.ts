import type { MoiReponse } from "./types";

// doit compiler : la réponse expose au moins login + roles
const _exemple: MoiReponse = { id: 1, login: "x", email: "y", roles: [] } as MoiReponse;
void _exemple;
