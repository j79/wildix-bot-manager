// Types partagés entre les composants du wizard BotCreate

export interface WimToolDraft {
  toolId: string
  variables: Record<string, string>
}

export interface TransferRuleDraft {
  id: string
  name: string
  description: string
  context: string
  extension: string
}

export interface EmbeddedToolDraft {
  enabled: boolean
  description: string
  context: string
}

export interface EmbeddedToolsDraft {
  transfer: TransferRuleDraft[]
  hangup: EmbeddedToolDraft
  wait: EmbeddedToolDraft
}

export interface SendMessageTarget {
  id: string
  type: 'user' | 'group'
  displayName: string
  context: string
}

export interface Section {
  key: string
  title: string
  content: string
  optional?: boolean
}

export interface BotDraft {
  pbxId: string
  botType: 'voicebot' | 'chatbot'
  name: string
  description: string
  enabled: boolean
  botFirstName: string
  companyName: string
  systemPrompt: string
  welcomeMessage: string
  interruptionsEnabled: boolean
  silenceTimeout: number
  maxCallDuration: number
  sendMessageTargets: SendMessageTarget[]
  wimToolsDraft: WimToolDraft[]
  voiceUrl: string
  dialplanId: number | null
  embeddedToolsDraft: EmbeddedToolsDraft
}

export const INITIAL: BotDraft = {
  pbxId: '',
  botType: 'voicebot',
  name: '',
  description: '',
  enabled: true,
  botFirstName: '',
  companyName: '',
  systemPrompt: '',
  welcomeMessage: '',
  interruptionsEnabled: true,
  silenceTimeout: 3,
  maxCallDuration: 300,
  sendMessageTargets: [],
  wimToolsDraft: [],
  voiceUrl: '',
  dialplanId: null,
  embeddedToolsDraft: {
    transfer: [],
    hangup: { enabled: true, description: "Fin d'appel", context: '' },
    wait:   { enabled: false, description: 'Mise en attente', context: '' },
  },
}

export type CreateMode = 'manual' | 'assisted' | 'ai' | null
