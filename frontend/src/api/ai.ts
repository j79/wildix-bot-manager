import { apiClient } from './client'
import { useAuthStore } from '@/stores/auth'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

// ── AI provider config ────────────────────────────────────────────────────────

export type AiProvider = 'ollama' | 'openai' | 'gemini' | 'anthropic' | 'groq'

export interface AiConfigPublic {
  provider:       AiProvider
  model:          string
  hasKey:         boolean
  ollama_url:     string
  savedProviders: Record<string, { hasKey: boolean; model: string; ollama_url: string }>
}

export interface AiConfigInput {
  provider:    AiProvider
  api_key?:    string
  model?:      string
  ollama_url?: string
}

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  ollama:    'Ollama',
  openai:    'OpenAI',
  gemini:    'Gemini',
  anthropic: 'Anthropic',
  groq:      'Groq',
}

export const PROVIDER_COLORS: Record<AiProvider, string> = {
  ollama:    'bg-gray-100 text-gray-700',
  openai:    'bg-green-100 text-green-700',
  gemini:    'bg-blue-100 text-blue-700',
  anthropic: 'bg-orange-100 text-orange-700',
  groq:      'bg-purple-100 text-purple-700',
}

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  ollama:    'qwen2.5:3b',
  openai:    'gpt-4o-mini',
  gemini:    'gemini-2.0-flash',
  anthropic: 'claude-haiku-4-5-20251001',
  groq:      'llama-3.1-8b-instant',
}

export interface TransferSuggestion {
  name: string
  description: string
  context: string
}

export interface ToolSuggestion {
  description: string
  context: string
}

export interface EmbeddedToolsSuggestion {
  transfer: TransferSuggestion[]
  hangup: ToolSuggestion | null
  wait: ToolSuggestion | null
}

export const aiConfigApi = {
  get:    ()                       => apiClient.get<AiConfigPublic>('/ai/config'),
  update: (data: AiConfigInput)    => apiClient.put<{ ok: boolean }>('/ai/config', data),
  test:   (data: AiConfigInput)    => apiClient.post<{ ok: boolean; message: string }>('/ai/config/test', data),
}

export interface GeneratePromptParams {
  pbxId?: string
  botType: 'voicebot' | 'chatbot'
  companyName: string
  industry: string
  useCase: string
  language?: string
  tone?: string
  extraContext?: string
  declaredTools?: string[]
}

export interface SuggestToolsParams {
  botDescription: string
  availableTools: Array<{ id: string; name: string; description: string; url: string }>
}

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const aiApi = {
  generatePrompt: (
    params: GeneratePromptParams,
  ): Promise<{ sections: Array<{ key: string; title: string; content: string }>; welcomeMessage: string; rapport: string }> => {
    return fetch(`${BASE}/ai/generate-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(params),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<{ sections: Array<{ key: string; title: string; content: string }>; welcomeMessage: string; rapport: string }>
    })
  },

  ttsPreview: (params: {
    provider: 'elevenlabs' | 'google'
    voiceId: string
    locale: string
    text: string
  }): Promise<{ audioBase64: string; contentType: string }> => {
    return fetch(`${BASE}/ai/tts-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(params),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<{ audioBase64: string; contentType: string }>
    })
  },

  chatStream: (
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt: string,
    onChunk: (partial: string) => void,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      fetch(`${BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ messages, systemPrompt }),
      })
        .then((res) => {
          if (!res.ok || !res.body) return reject(new Error(`HTTP ${res.status}`))

          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buf = ''
          let full = ''

          const read = () => {
            reader.read().then(({ done, value }) => {
              if (done) { resolve(full); return }

              buf += decoder.decode(value, { stream: true })
              const lines = buf.split('\n')
              buf = lines.pop() ?? ''

              for (const line of lines) {
                if (!line.startsWith('data: ')) continue
                const data = line.slice(6).trim()
                if (data === '[DONE]') { resolve(full); return }
                try {
                  const obj = JSON.parse(data) as { chunk?: string; error?: string }
                  if (obj.error) { reject(new Error(obj.error)); return }
                  if (obj.chunk) { full += obj.chunk; onChunk(obj.chunk) }
                } catch { /* partial */ }
              }
              read()
            }).catch(reject)
          }
          read()
        })
        .catch(reject)
    })
  },

  suggestEmbeddedTools: (params: { systemPrompt: string }): Promise<EmbeddedToolsSuggestion> => {
    return fetch(`${BASE}/ai/suggest-embedded-tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(params),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<EmbeddedToolsSuggestion>
    })
  },

  suggestTools: (params: SuggestToolsParams) => {
    return fetch(`${BASE}/ai/suggest-tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(params),
    }).then((r) => r.json()) as Promise<{
      suggested: SuggestToolsParams['availableTools']
      rawResponse: string
    }>
  },

  refineSection: (params: {
    sectionTitle: string
    sectionContent: string
    userRequest: string
    language?: string
  }): Promise<{ content: string }> => {
    return fetch(`${BASE}/ai/refine-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(params),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<{ content: string }>
    })
  },

  translateTemplate: (params: {
    sections: Array<{ key: string; title: string; content: string }>
    name: string
    sector: string
    useCase: string
  }): Promise<{
    translations: Record<string, {
      sections: Array<{ key: string; title: string; content: string }>
      name: string
      sector: string
      useCase: string
    }>
  }> => {
    return fetch(`${BASE}/ai/translate-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(params),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
  },
}
