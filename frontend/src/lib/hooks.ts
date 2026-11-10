import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import { api, buildUrl, type QueryParams } from './http'
import type { Paginated } from './types'

/**
 * Ressources API : un nom logique (« referentiel/ecoles ») utilisé à la fois
 * pour construire l'URL et comme préfixe d'invalidation du cache.
 */
export type Resource = string

export function resourceUrl(resource: Resource, id?: number | string): string {
  const base = `${'/api/v1'}/${resource.replace(/^\/+|\/+$/g, '')}/`
  return id === undefined ? base : `${base}${id}/`
}

function listKey(resource: Resource, params?: QueryParams): QueryKey {
  return ['list', resource, params ?? {}]
}

/* ------------------------------------------------------------------ */
/* Lectures                                                            */
/* ------------------------------------------------------------------ */

export function usePagedList<T>(
  resource: Resource,
  params?: QueryParams,
  options?: Omit<
    UseQueryOptions<Paginated<T>, Error, Paginated<T>, QueryKey>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery<Paginated<T>, Error, Paginated<T>, QueryKey>({
    queryKey: listKey(resource, params),
    queryFn: ({ signal }) => api.get<Paginated<T>>(resourceUrl(resource), { params, signal }),
    ...options,
  })
}

/** Première page uniquement — suffisant pour les listes de référence courtes. */
export function useList<T>(
  resource: Resource,
  params?: QueryParams,
  options?: Omit<UseQueryOptions<T[], Error, T[], QueryKey>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T[], Error, T[], QueryKey>({
    queryKey: [...listKey(resource, params), 'first-page'],
    queryFn: async ({ signal }) => {
      const data = await api.get<Paginated<T> | T[]>(resourceUrl(resource), { params, signal })
      return Array.isArray(data) ? data : data.results
    },
    ...options,
  })
}

/**
 * Toutes les pages d'une ressource paginée (sélecteurs de classes, matières…).
 * Borné à 25 pages (25 × 25 = 625 lignes) pour éviter une boucle sans fin si
 * l'API renvoyait un `next` erroné.
 */
export function useAll<T>(
  resource: Resource,
  params?: QueryParams,
  options?: Omit<UseQueryOptions<T[], Error, T[], QueryKey>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T[], Error, T[], QueryKey>({
    queryKey: [...listKey(resource, params), 'all'],
    queryFn: async ({ signal }) => {
      const lignes: T[] = []
      let url: string | null = buildUrl(resourceUrl(resource), params)
      let pages = 0
      while (url && pages < 25) {
        const data: Paginated<T> | T[] = await api.get<Paginated<T> | T[]>(url, { signal })
        if (Array.isArray(data)) {
          lignes.push(...data)
          break
        }
        lignes.push(...data.results)
        url = data.next
        pages += 1
      }
      return lignes
    },
    ...options,
  })
}

export function useDetail<T>(
  resource: Resource,
  id: number | string | undefined | null,
  options?: Omit<UseQueryOptions<T, Error, T, QueryKey>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T, Error, T, QueryKey>({
    queryKey: ['detail', resource, id],
    queryFn: ({ signal }) => api.get<T>(resourceUrl(resource, id ?? ''), { signal }),
    enabled: id !== undefined && id !== null && id !== '',
    ...options,
  })
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

function useInvalidateResource(resource: Resource) {
  const queryClient = useQueryClient()
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['list', resource] }),
      queryClient.invalidateQueries({ queryKey: ['detail', resource] }),
    ])
  }, [queryClient, resource])
}

export function useCreate<T, TBody = Record<string, unknown>>(resource: Resource) {
  const invalidate = useInvalidateResource(resource)
  return useMutation<T, Error, TBody>({
    mutationFn: (body) => api.post<T>(resourceUrl(resource), body),
    onSuccess: invalidate,
  })
}

export function useUpdate<T, TBody = Record<string, unknown>>(resource: Resource) {
  const invalidate = useInvalidateResource(resource)
  return useMutation<T, Error, { id: number | string; body: TBody }>({
    mutationFn: ({ id, body }) => api.patch<T>(resourceUrl(resource, id), body),
    onSuccess: invalidate,
  })
}

export function useRemove<T = void>(resource: Resource) {
  const invalidate = useInvalidateResource(resource)
  return useMutation<T, Error, number | string>({
    mutationFn: (id) => api.delete<T>(resourceUrl(resource, id)),
    onSuccess: invalidate,
  })
}

/**
 * Action métier non CRUD (`POST /.../{id}/valider/`, `.../payer/`, …).
 * Invalide toutes les listes du préfixe indiqué : une validation change le
 * statut affiché dans plusieurs écrans.
 */
export function useAction<TBody = Record<string, unknown>, TResult = unknown>(
  path: string,
  invalidatePrefixes: Resource[] = [],
) {
  const queryClient = useQueryClient()
  return useMutation<TResult, Error, TBody | undefined>({
    mutationFn: (body) => api.post<TResult>(path, body ?? {}),
    onSuccess: async () => {
      await Promise.all([
        ...invalidatePrefixes.map((prefix) =>
          queryClient.invalidateQueries({ queryKey: ['list', prefix] }),
        ),
        queryClient.invalidateQueries({ queryKey: ['rapport'] }),
        queryClient.invalidateQueries({ queryKey: ['tableau-de-bord'] }),
      ])
    },
  })
}

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}

/** Paramètres d'URL typés (filtres persistés dans l'adresse). */
export function useSearchParamState(
  key: string,
): [string, (value: string) => void] {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get(key) ?? ''
  })
  const set = useCallback(
    (next: string) => {
      setValue(next)
      const url = new URL(window.location.href)
      if (next) url.searchParams.set(key, next)
      else url.searchParams.delete(key)
      window.history.replaceState({}, '', url)
    },
    [key],
  )
  return [value, set]
}
