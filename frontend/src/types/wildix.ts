export type BotType = 'voicebot' | 'chatbot'

// ── WILMA VoiceBots ───────────────────────────────────────────────────────────

export interface VoiceBotEmbeddedToolParams {
  extension?: string
  context?: string
  description?: string
  id?: string                    // pour DELEGATE : id du bot cible
  pipeline?: { type?: string; instructions?: string }
}

export interface VoiceBotEmbeddedTool {
  type: 'HANGUP' | 'TRANSFER' | 'DELEGATE' | 'WAIT' | 'HANDOVER' | 'SUGGESTIONS'
  name: string
  parameters?: VoiceBotEmbeddedToolParams
}

export interface VoiceBotInlineTool {
  function: {
    name: string
    description?: string
    integration?: {
      webhook?: {
        method?: string
        url?: string
        authorization?: {
          bearer?: { token: string }
          oauth?: unknown
        }
      }
    }
    parameters?: {
      type: 'object'
      properties?: Record<string, { type: string; description?: string; const?: string }>
      required?: string[]
    }
  }
  type?: 'function'
}

export interface VoiceBotLlmEndpoint {
  prompt: string
  model?: string
  embeddedTools?: VoiceBotEmbeddedTool[]
  tools?: VoiceBotInlineTool[]
  metadata?: unknown
}

export interface VoiceBotEndpoint {
  llm?: VoiceBotLlmEndpoint
  webhook?: { url: string; secret: string }
  dialogflowCx?: unknown
  openAiAssistant?: unknown
  sqs?: unknown
}

export interface VoiceBotPipelineSettings {
  interuptionsEnabled?: boolean   // note: typo intentionnel dans l'API Wildix
  maximumDuration?: number        // secondes
  silenceTimeout?: number         // secondes
  endCallEnabled?: boolean
}

export interface VoiceBotCapability {
  tool?: { id: string; variables?: unknown[]; pipeline?: unknown }
  kb?: { knowledgeBaseId: string; instructions?: string }
}

export interface VoiceBot {
  id: string
  name: string
  message?: string                // message d'accueil
  category?: string
  endpoint?: VoiceBotEndpoint
  pipeline?: VoiceBotPipelineSettings
  capabilities?: VoiceBotCapability[]
  groupId?: string
  createdAt: string
  updatedAt?: string
  enabled?: boolean
  description?: string
}

// ── X-Bees ChatBots ───────────────────────────────────────────────────────────

export interface ChatBot {
  id: string
  name: string
  access?: string               // 'EVERYBODY' | autres valeurs
  integrationType?: string      // 'LLM' | 'WEBHOOK'
  searchable?: boolean
  picture?: string
  createdAt: string
  updatedAt?: string
  enabled?: boolean
  description?: string
  systemPrompt?: string
}

// ── WIM Tools ────────────────────────────────────────────────────────────────

export interface WimToolVariable {
  name: string
  description?: string
  type: string
  optional: boolean
}

export type WimToolType = 'chat' | 'webhook' | 'email' | 'sms' | 'unknown'

export interface WimTool {
  id: string
  name: string
  description?: string
  category?: string
  companyId?: string
  handler: {
    chat?: { config?: { botName?: string; recipient?: { channelId?: string }; text?: string } }
    webhook?: { url?: string; method?: string; authorization?: unknown }
    email?: unknown
    sms?: unknown
  }
  input?: { variables: WimToolVariable[] }
  // anciens champs (compatibilité)
  url?: string
  method?: string
  headers?: Record<string, string>
  enabled?: boolean
}

// ── IA génération de prompt ───────────────────────────────────────────────────

export interface PromptSections {
  contexte: string
  ton: string
  informations: string
  outils: string
  deroulé: string
  jamais: string
  priorite: string
}

export interface GeneratedPrompt {
  sections: PromptSections
  welcomeMessage: string
  pipelineSuggestions: VoiceBotPipelineSettings
  summary: string
  suggestedEmbeddedTools: VoiceBotEmbeddedTool[]
}

// -- Dialplan (API locale PBX) ------------------------------------------------

export interface DialplanSummary {
  id: number
  name: string
  description?: string
}

export interface DialplanNumber {
  number: string
  comment?: string
}

export interface DialplanDetail {
  id: number
  name: string
  description?: string
  numbers: DialplanNumber[]
}

export interface DialplanData {
  configured: boolean
  dialplans: DialplanSummary[]
  errors?: { dialplans?: string | null }
}
