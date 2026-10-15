import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api/client";

export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ParamsListe = Record<string, string | number | undefined>;

export async function jsonOuLeve(resp: Response) {
  const corps = resp.status === 204 ? null : await resp.json().catch(() => null);
  if (!resp.ok) {
    throw Object.assign(new Error(`HTTP ${resp.status}`), {
      status: resp.status,
      payload: corps,
    });
  }
  return corps;
}

function qs(params: ParamsListe): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function createResourceHooks<T extends { id: number }>(endpoint: string) {
  const cleListe = (params: ParamsListe) => [endpoint, "liste", params] as const;
  const cleDetail = (id: number) => [endpoint, "detail", id] as const;

  return {
    useListe(params: ParamsListe = {}) {
      return useQuery({
        queryKey: cleListe(params),
        queryFn: () =>
          apiFetch(`/${endpoint}/${qs(params)}`).then(jsonOuLeve) as Promise<Page<T>>,
      });
    },
    useDetail(id: number) {
      return useQuery({
        queryKey: cleDetail(id),
        queryFn: () =>
          apiFetch(`/${endpoint}/${id}/`).then(jsonOuLeve) as Promise<T>,
        enabled: Number.isFinite(id),
      });
    },
    useCreer() {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (corps: Partial<T> | FormData) =>
          apiFetch(`/${endpoint}/`, {
            method: "POST",
            body: corps instanceof FormData ? corps : JSON.stringify(corps),
          }).then(jsonOuLeve) as Promise<T>,
        onSuccess: () => qc.invalidateQueries({ queryKey: [endpoint, "liste"] }),
      });
    },
    useModifier() {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: ({ id, corps }: { id: number; corps: Partial<T> | FormData }) =>
          apiFetch(`/${endpoint}/${id}/`, {
            method: "PATCH",
            body: corps instanceof FormData ? corps : JSON.stringify(corps),
          }).then(jsonOuLeve) as Promise<T>,
        onSuccess: (_d, { id }) => {
          qc.invalidateQueries({ queryKey: [endpoint, "liste"] });
          qc.invalidateQueries({ queryKey: cleDetail(id) });
        },
      });
    },
    useSupprimer() {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (id: number) =>
          apiFetch(`/${endpoint}/${id}/`, { method: "DELETE" }).then(jsonOuLeve),
        onSuccess: () => qc.invalidateQueries({ queryKey: [endpoint, "liste"] }),
      });
    },
    /** Appelle une action POST détail (`/{endpoint}/{id}/{action}/`), ex. valider/engager/payer. */
    useAction(action: string) {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: ({ id, corps }: { id: number; corps?: Record<string, unknown> }) =>
          apiFetch(`/${endpoint}/${id}/${action}/`, {
            method: "POST",
            body: corps ? JSON.stringify(corps) : undefined,
          }).then(jsonOuLeve) as Promise<T>,
        onSuccess: (_d, { id }) => {
          qc.invalidateQueries({ queryKey: [endpoint, "liste"] });
          qc.invalidateQueries({ queryKey: cleDetail(id) });
        },
      });
    },
  };
}
