import { useAuthStore } from '@/stores/auth'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

interface RequestOptions extends RequestInit {
  skipAuth?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, ...init } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  }

  if (!skipAuth) {
    const token = useAuthStore.getState().token
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers })

  if (res.status === 401) {
    useAuthStore.getState().clearAuth()
    window.location.href = '/login'
    throw new Error('Session expirée')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const apiClient = {
  get:    <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: 'GET', ...opts }),
  post:   <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), ...opts }),
  put:    <T>(path: string, body: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body), ...opts }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: 'DELETE', ...opts }),
}
