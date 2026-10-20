/**
 * Client HTTP de l'API ESSIG Gest.
 *
 * - Access token JWT gardé en mémoire (jamais dans localStorage), avec un
 *   miroir `sessionStorage` pour survivre à un rechargement d'onglet.
 * - Refresh token en cookie httpOnly côté Django : on l'envoie via
 *   `credentials: 'include'` en appelant `/api/v1/auth/refresh/`.
 * - Renouvellement silencieux : une 401 déclenche un refresh (une seule
 *   requête de refresh concurrente, les autres appels attendent), puis la
 *   requête initiale est rejouée une fois.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
export const API_PREFIX = '/api/v1'

const ACCESS_TOKEN_KEY = 'essig.access_token'

export interface ApiFieldErrors {
  [field: string]: string[]
}

export class ApiError extends Error {
  status: number
  payload: unknown
  fields?: ApiFieldErrors

  constructor(status: number, payload: unknown, message?: string) {
    super(message ?? humanizeError(payload, status))
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
    this.fields = extractFieldErrors(payload)
  }
}

export class NetworkError extends Error {
  constructor() {
    super("Le serveur est injoignable. Vérifiez votre connexion puis réessayez.")
    this.name = 'NetworkError'
  }
}

/** Transforme une charge d'erreur DRF en message lisible en français. */
export function humanizeError(payload: unknown, status?: number): string {
  if (typeof payload === 'string' && payload.trim()) return payload
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>
    for (const key of ['detail', 'error', 'message', 'non_field_errors']) {
      if (key in data) {
        const value = data[key]
        if (typeof value === 'string') return value
        if (Array.isArray(value) && value.length > 0) return value.map(String).join(' ')
      }
    }
    const entries = Object.entries(data)
    if (entries.length > 0) {
      const [field, value] = entries[0]
      const messages = Array.isArray(value) ? value.map(String).join(' ') : String(value)
      return `${labelize(field)} : ${messages}`
    }
  }
  if (status === 401) return 'Session expirée. Veuillez vous reconnecter.'
  if (status === 403) return "Vous n'avez pas les droits pour cette action."
  if (status === 404) return 'Élément introuvable.'
  if (status === 409) return 'Suppression impossible : cet élément est utilisé ailleurs.'
  if (status === 429) return 'Trop de tentatives. Patientez une minute avant de réessayer.'
  if (status && status >= 500) return 'Une erreur est survenue côté serveur.'
  return 'Une erreur est survenue.'
}

function extractFieldErrors(payload: unknown): ApiFieldErrors | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined
  const out: ApiFieldErrors = {}
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      out[key] = value as string[]
    } else if (typeof value === 'string' && key !== 'detail' && key !== 'error') {
      out[key] = [value]
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function labelize(field: string): string {
  const clean = field.replace(/_/g, ' ').replace(/\./g, ' ')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/* ------------------------------------------------------------------ */
/* Jetons                                                              */
/* ------------------------------------------------------------------ */

let accessToken: string | null = readStoredToken()
const tokenListeners = new Set<(token: string | null) => void>()

function readStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
  try {
    if (token) window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
    else window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  } catch {
    /* stockage indisponible (navigation privée stricte) : on reste en mémoire */
  }
  tokenListeners.forEach((listener) => listener(token))
}

export function onTokenChange(listener: (token: string | null) => void): () => void {
  tokenListeners.add(listener)
  return () => tokenListeners.delete(listener)
}

/* ------------------------------------------------------------------ */
/* Requêtes                                                            */
/* ------------------------------------------------------------------ */

export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue>

export function buildUrl(path: string, params?: QueryParams): string {
  const base = path.startsWith('http') ? path : `${API_BASE_URL}${path}`
  if (!params) return base
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.append(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: QueryParams
  signal?: AbortSignal
  /** Ajoute l'en-tête Authorization (défaut : true). */
  auth?: boolean
  /** Rejoue la requête après un refresh de jeton (défaut : true). */
  retryOn401?: boolean
  headers?: Record<string, string>
}

/** Émis quand le rafraîchissement échoue : le shell renvoie vers la connexion. */
export const EVENEMENT_SESSION_EXPIREE = 'essig:session-expiree'

function signalerSessionExpiree(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENEMENT_SESSION_EXPIREE))
  }
}

let refreshInFlight: Promise<string | null> | null = null

/** Demande un nouvel access token à partir du cookie refresh httpOnly. */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(buildUrl(`${API_PREFIX}/auth/refresh/`), {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) {
          setAccessToken(null)
          return null
        }
        const data = (await response.json()) as { access?: string }
        if (!data.access) {
          setAccessToken(null)
          return null
        }
        setAccessToken(data.access)
        return data.access
      } catch {
        return null
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, signal, auth = true, retryOn401 = true } = options
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  }
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getAccessToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      credentials: 'include',
      headers,
      signal,
      body:
        body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    throw new NetworkError()
  }

  if (response.status === 401 && auth && retryOn401) {
    const renewed = await refreshAccessToken()
    if (renewed) {
      return request<T>(path, { ...options, retryOn401: false })
    }
    setAccessToken(null)
    signalerSessionExpiree()
  }

  if (!response.ok) {
    let payload: unknown = null
    const contentType = response.headers.get('content-type') ?? ''
    try {
      payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text()
    } catch {
      payload = null
    }
    throw new ApiError(response.status, payload)
  }

  if (response.status === 204 || response.status === 205) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return (await response.text()) as unknown as T
  }
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}

/**
 * Télécharge (ou ouvre) un document servi par l'API (PDF bulletins, reçus…).
 * Le flux est récupéré avec le jeton d'authentification, puis exposé au
 * navigateur via une URL d'objet — indispensable car un simple <a href>
 * n'enverrait pas l'en-tête Authorization.
 */
export async function openDocument(
  path: string,
  params?: QueryParams,
  disposition: 'inline' | 'attachment' = 'inline',
): Promise<void> {
  const fetchDoc = async (): Promise<Response> =>
    fetch(buildUrl(path, { ...params, disposition }), {
      credentials: 'include',
      headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
    })

  let response = await fetchDoc()
  if (response.status === 401) {
    const renewed = await refreshAccessToken()
    if (renewed) response = await fetchDoc()
  }
  if (!response.ok) {
    throw new ApiError(response.status, null)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  if (disposition === 'attachment') {
    const link = document.createElement('a')
    link.href = url
    link.download = filenameFromDisposition(response.headers.get('content-disposition')) ?? 'document'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } else {
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) {
      const link = document.createElement('a')
      link.href = url
      link.download = 'document.pdf'
      link.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)
  return match ? decodeURIComponent(match[1]) : null
}
