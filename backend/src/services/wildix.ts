import { AppError } from '../lib/errors.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PbxCredentials {
  api_token: string
  pbx_host: string
  pbx_serial: string
  pbx_local_token: string
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function wildixFetch<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, options)

  if (!res.ok) {
    let msg = `Wildix API error: ${res.status}`
    try {
      const body = await res.json() as { message?: string; error?: string }
      msg = body.message ?? body.error ?? msg
    } catch { /* ignore */ }
    // Ne pas passer 401/403 de l'API Wildix : le frontend les interprète comme
    // une expiration de session et déconnecte l'utilisateur.
    const status = (res.status === 401 || res.status === 403 || res.status >= 500)
      ? 502
      : res.status
    throw new AppError(status, msg)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

// ── VoiceBots WILMA — https://wim.wildix.com/v2/voicebots/bots ──────────────

const WILMA_BASE = 'https://wim.wildix.com/v2'

export const wilmaApi = {
  list: async <T>(creds: PbxCredentials) => {
    const res = await wildixFetch<{ bots: T[] }>(`${WILMA_BASE}/voicebots/bots`, {
      headers: { Authorization: `Bearer ${creds.api_token}` },
    })
    return res.bots
  },

  get: async <T>(creds: PbxCredentials, id: string) => {
    const res = await wildixFetch<{ bot: T }>(`${WILMA_BASE}/voicebots/bots/${id}`, {
      headers: { Authorization: `Bearer ${creds.api_token}` },
    })
    return res.bot
  },

  create: async <T>(creds: PbxCredentials, data: unknown) => {
    const res = await wildixFetch<{ bot: T }>(`${WILMA_BASE}/voicebots/bots`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    return res.bot
  },

  update: async <T>(creds: PbxCredentials, id: string, data: unknown) => {
    const res = await wildixFetch<{ bot: T }>(`${WILMA_BASE}/voicebots/bots/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${creds.api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    return res.bot
  },

  delete: (creds: PbxCredentials, id: string) =>
    wildixFetch<void>(`${WILMA_BASE}/voicebots/bots/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${creds.api_token}` },
    }),
}

// ── ChatBots X-Bees — https://api.x-bees.com/v2/users/bots ──────────────────
// userId est pbx_serial dans nos credentials

const XBEES_BASE = 'https://api.x-bees.com/v2'

export const xBeesApi = {
  list: async <T>(creds: PbxCredentials) => {
    const res = await wildixFetch<{ bots: T[] }>(
      `${XBEES_BASE}/users/bots?userId=${creds.pbx_serial}`,
      { headers: { Authorization: `Bearer ${creds.api_token}` } },
    )
    return res.bots
  },

  get: <T>(creds: PbxCredentials, id: string) =>
    wildixFetch<T>(`${XBEES_BASE}/users/bots/${id}?userId=${creds.pbx_serial}`, {
      headers: { Authorization: `Bearer ${creds.api_token}` },
    }),

  create: <T>(creds: PbxCredentials, data: unknown) =>
    wildixFetch<T>(`${XBEES_BASE}/users/bots?userId=${creds.pbx_serial}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }),

  update: <T>(creds: PbxCredentials, id: string, data: unknown) =>
    wildixFetch<T>(`${XBEES_BASE}/users/bots/${id}?userId=${creds.pbx_serial}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${creds.api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }),

  delete: (creds: PbxCredentials, id: string) =>
    wildixFetch<void>(`${XBEES_BASE}/users/bots/${id}?userId=${creds.pbx_serial}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${creds.api_token}` },
    }),
}

// ── WIM Tools — https://tools.wim.wildix.com/v1/tools ────────────────────────

const TOOLS_BASE = 'https://tools.wim.wildix.com/v1'

export const wimToolsApi = {
  list: async <T>(creds: PbxCredentials) => {
    const res = await wildixFetch<{ tools: T[] }>(`${TOOLS_BASE}/tools`, {
      headers: { Authorization: `Bearer ${creds.api_token}` },
    })
    return res.tools
  },

  get: async <T>(creds: PbxCredentials, id: string) => {
    const res = await wildixFetch<{ tool: T }>(`${TOOLS_BASE}/tools/${id}`, {
      headers: { Authorization: `Bearer ${creds.api_token}` },
    })
    return res.tool
  },

  create: async <T>(creds: PbxCredentials, data: unknown) => {
    const res = await wildixFetch<{ tool: T }>(`${TOOLS_BASE}/tools`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    return res.tool
  },

  update: async <T>(creds: PbxCredentials, id: string, data: unknown) => {
    const res = await wildixFetch<{ tool: T }>(`${TOOLS_BASE}/tools/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${creds.api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    return res.tool
  },

  delete: (creds: PbxCredentials, id: string) =>
    wildixFetch<void>(`${TOOLS_BASE}/tools/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${creds.api_token}` },
    }),
}
