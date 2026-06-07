import { getAdminPb } from './pocketbase.js'
import { env } from '../lib/env.js'
import { AppError } from '../lib/errors.js'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiProvider = 'ollama' | 'openai' | 'gemini' | 'anthropic' | 'groq'

export interface AiConfig {
  provider: AiProvider
  api_key: string
  model: string
  ollama_url: string
}

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  ollama:    'Ollama',
  openai:    'OpenAI',
  gemini:    'Gemini',
  anthropic: 'Anthropic',
  groq:      'Groq',
}

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  ollama:    env.OLLAMA_MODEL,
  openai:    'gpt-4o-mini',
  gemini:    'gemini-2.0-flash',
  anthropic: 'claude-haiku-4-5-20251001',
  groq:      'llama-3.1-8b-instant',
}

// ── Config cache ──────────────────────────────────────────────────────────────

let _configCache: AiConfig | null = null
let _configTs = 0
const CACHE_TTL = 0  // disabled — always read fresh

export async function getAiConfig(): Promise<AiConfig> {
  if (_configCache && Date.now() - _configTs < CACHE_TTL) return _configCache

  const fallback: AiConfig = {
    provider: 'ollama',
    api_key:  '',
    model:    env.OLLAMA_MODEL,
    ollama_url: env.OLLAMA_URL,
  }

  try {
    const pb = await getAdminPb()
    const allRecords = await pb.collection('ai_config').getList(1, 50).then(r => r.items)
    // Skip key_ cache records — active record has a real provider name
    const records = allRecords.filter((r: any) => !String(r['provider']).startsWith('key_'))
    if (records.length > 0) {
      const r = records[0]
      const prov = (r['provider'] as AiProvider) || fallback.provider
      _configCache = {
        provider:   prov,
        api_key:    (r['api_key']    as string) || '',
        model:      (r['model']      as string) || DEFAULT_MODELS[prov],
        ollama_url: (r['ollama_url'] as string) || env.OLLAMA_URL,
      }
    } else {
      _configCache = fallback
    }
  } catch {
    _configCache = fallback
  }

  _configTs = Date.now()
  return _configCache
}

export function invalidateAiConfigCache(): void {
  _configCache = null
  _configTs = 0
}

// ── Ollama ────────────────────────────────────────────────────────────────────

async function streamOllama(
  cfg: AiConfig,
  messages: LLMMessage[],
  onChunk: (t: string) => Promise<void>,
): Promise<string> {
  const res = await fetch(`${cfg.ollama_url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(300_000),
    body: JSON.stringify({
      model:   cfg.model || DEFAULT_MODELS.ollama,
      messages,
      stream:  true,
      options: { temperature: 0.3, num_ctx: 8192 },
    }),
  })

  if (!res.ok || !res.body) throw new AppError(502, `Ollama error: ${res.status}`)

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as { message?: { content?: string } }
        const chunk = obj.message?.content ?? ''
        if (chunk) { full += chunk; await onChunk(chunk) }
      } catch { /* partial line */ }
    }
  }
  return full
}

// ── OpenAI / Groq (OpenAI-compatible) ────────────────────────────────────────

async function streamOpenAICompat(
  cfg: AiConfig,
  messages: LLMMessage[],
  onChunk: (t: string) => Promise<void>,
): Promise<string> {
  if (!cfg.api_key) throw new AppError(500, `Clé API manquante pour ${cfg.provider}`)

  const baseUrl = cfg.provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1'
  const model   = cfg.model || DEFAULT_MODELS[cfg.provider]

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.api_key}`,
    },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.3 }),
  })

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new AppError(502, err.error?.message ?? `API error: ${res.status}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buf  = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue
      try {
        const obj = JSON.parse(data) as { choices?: [{ delta?: { content?: string } }] }
        const chunk = obj.choices?.[0]?.delta?.content ?? ''
        if (chunk) { full += chunk; await onChunk(chunk) }
      } catch { /* malformed */ }
    }
  }
  return full
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async function streamGemini(
  cfg: AiConfig,
  messages: LLMMessage[],
  onChunk: (t: string) => Promise<void>,
): Promise<string> {
  if (!cfg.api_key) throw new AppError(500, 'Clé API Gemini manquante')

  const model     = cfg.model || DEFAULT_MODELS.gemini
  const systemMsg = messages.find(m => m.role === 'system')?.content
  const contents  = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))

  const body: Record<string, unknown> = { contents, generationConfig: { temperature: 0.3 } }
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg }] }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${cfg.api_key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new AppError(502, err.error?.message ?? `Gemini error: ${res.status}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buf  = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data || data === '[DONE]') continue
      try {
        type GChunk = { candidates?: [{ content?: { parts?: [{ text?: string }] } }] }
        const obj   = JSON.parse(data) as GChunk
        const chunk = obj.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        if (chunk) { full += chunk; await onChunk(chunk) }
      } catch { /* partial */ }
    }
  }
  return full
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

async function streamAnthropic(
  cfg: AiConfig,
  messages: LLMMessage[],
  onChunk: (t: string) => Promise<void>,
): Promise<string> {
  if (!cfg.api_key) throw new AppError(500, 'Clé API Anthropic manquante')

  const model     = cfg.model || DEFAULT_MODELS.anthropic
  const systemMsg = messages.find(m => m.role === 'system')?.content
  const chatMsgs  = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }))

  const body: Record<string, unknown> = { model, max_tokens: 4096, messages: chatMsgs, stream: true }
  if (systemMsg) body.system = systemMsg

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       cfg.api_key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new AppError(502, err.error?.message ?? `Anthropic error: ${res.status}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buf  = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data) continue
      try {
        type ADelta = { type: string; delta?: { type?: string; text?: string } }
        const obj = JSON.parse(data) as ADelta
        if (obj.type === 'content_block_delta' && obj.delta?.type === 'text_delta') {
          const chunk = obj.delta.text ?? ''
          if (chunk) { full += chunk; await onChunk(chunk) }
        }
      } catch { /* partial */ }
    }
  }
  return full
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function streamGenerate(
  messages: LLMMessage[],
  onChunk: (t: string) => Promise<void>,
): Promise<string> {
  const cfg = await getAiConfig()
  switch (cfg.provider) {
    case 'ollama':    return streamOllama(cfg, messages, onChunk)
    case 'openai':
    case 'groq':      return streamOpenAICompat(cfg, messages, onChunk)
    case 'gemini':    return streamGemini(cfg, messages, onChunk)
    case 'anthropic': return streamAnthropic(cfg, messages, onChunk)
    default:          return streamOllama(cfg, messages, onChunk)
  }
}

export async function generate(messages: LLMMessage[]): Promise<string> {
  let result = ''
  await streamGenerate(messages, async (chunk) => { result += chunk })
  return result
}

// ── Test a config (no-save) ───────────────────────────────────────────────────

export async function testAiConfig(cfg: AiConfig): Promise<{ ok: boolean; message: string }> {
  try {
    switch (cfg.provider) {
      case 'ollama': {
        const url = cfg.ollama_url || env.OLLAMA_URL
        const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) return { ok: false, message: `Ollama inaccessible (HTTP ${res.status})` }
        const data = await res.json() as { models?: Array<{ name: string }> }
        const count     = data.models?.length ?? 0
        const modelName = cfg.model || env.OLLAMA_MODEL
        const hasModel  = data.models?.some(m => m.name === modelName || m.name.startsWith(modelName.split(':')[0])) ?? false
        return {
          ok: true,
          message: `Ollama connecté — ${count} modèle(s)${hasModel ? `, "${modelName}" disponible` : `, "${modelName}" non trouvé`}`,
        }
      }
      case 'openai':
      case 'groq': {
        if (!cfg.api_key) return { ok: false, message: 'Clé API manquante' }
        const baseUrl = cfg.provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1'
        const model   = cfg.model || DEFAULT_MODELS[cfg.provider]
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.api_key}` },
          body:    JSON.stringify({ model, messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 5, stream: false }),
          signal:  AbortSignal.timeout(15000),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
          return { ok: false, message: err.error?.message ?? `HTTP ${res.status}` }
        }
        const label = cfg.provider === 'groq' ? 'Groq Cloud' : 'OpenAI'
        return { ok: true, message: `${label} — clé valide, modèle "${model}" accessible` }
      }
      case 'gemini': {
        if (!cfg.api_key) return { ok: false, message: 'Clé API manquante' }
        const model = cfg.model || DEFAULT_MODELS.gemini
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.api_key}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }], generationConfig: { maxOutputTokens: 5 } }),
            signal:  AbortSignal.timeout(15000),
          },
        )
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
          return { ok: false, message: err.error?.message ?? `HTTP ${res.status}` }
        }
        return { ok: true, message: `Gemini — clé valide, modèle "${model}" accessible` }
      }
      case 'anthropic': {
        if (!cfg.api_key) return { ok: false, message: 'Clé API manquante' }
        const model = cfg.model || DEFAULT_MODELS.anthropic
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.api_key, 'anthropic-version': '2023-06-01' },
          body:    JSON.stringify({ model, max_tokens: 5, messages: [{ role: 'user', content: 'Say OK' }], stream: false }),
          signal:  AbortSignal.timeout(15000),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
          return { ok: false, message: err.error?.message ?? `HTTP ${res.status}` }
        }
        return { ok: true, message: `Anthropic — clé valide, modèle "${model}" accessible` }
      }
      default:
        return { ok: false, message: 'Fournisseur inconnu' }
    }
  } catch (e) {
    const msg = String(e)
    if (msg.includes('timeout') || msg.includes('abort')) return { ok: false, message: 'Timeout — service inaccessible' }
    return { ok: false, message: msg }
  }
}
