import { apiClient } from './client'
import type { VoiceBot, ChatBot, WimTool, DialplanData, DialplanDetail } from '@/types/wildix'

const q = (pbxId: string, extra?: Record<string, string>) => {
  const p = new URLSearchParams({ pbxId, ...extra })
  return `?${p.toString()}`
}

export const botsApi = {
  list: (pbxId: string) =>
    apiClient.get<{ voicebots: VoiceBot[]; chatbots: ChatBot[] }>(`/bots${q(pbxId)}`),

  get: (id: string, pbxId: string, type: 'voicebot' | 'chatbot' = 'voicebot') =>
    apiClient.get<VoiceBot | ChatBot>(`/bots/${id}${q(pbxId, { type })}`),

  create: (pbxId: string, data: Partial<VoiceBot | ChatBot>, type: 'voicebot' | 'chatbot' = 'voicebot') =>
    apiClient.post<VoiceBot | ChatBot>(`/bots${q(pbxId, { type })}`, data),

  update: (id: string, pbxId: string, data: Partial<VoiceBot | ChatBot>, type: 'voicebot' | 'chatbot' = 'voicebot') =>
    apiClient.put<VoiceBot | ChatBot>(`/bots/${id}${q(pbxId, { type })}`, data),

  delete: (id: string, pbxId: string, type: 'voicebot' | 'chatbot' = 'voicebot') =>
    apiClient.delete<void>(`/bots/${id}${q(pbxId, { type })}`),

  clone: (
    id: string,
    pbxId: string,
    targetPbxId: string,
    type: 'voicebot' | 'chatbot',
    cloneName?: string,
  ) =>
    apiClient.post<VoiceBot | ChatBot>(`/bots/${id}/clone${q(pbxId)}`, {
      targetPbxId,
      type,
      cloneName,
    }),
}

export const toolsApi = {
  list:   (pbxId: string) =>
    apiClient.get<WimTool[]>(`/tools${q(pbxId)}`),

  create: (pbxId: string, data: Partial<WimTool>) =>
    apiClient.post<WimTool>(`/tools${q(pbxId)}`, data),

  update: (id: string, pbxId: string, data: Partial<WimTool>) =>
    apiClient.put<WimTool>(`/tools/${id}${q(pbxId)}`, data),

  delete: (id: string, pbxId: string) =>
    apiClient.delete<void>(`/tools/${id}${q(pbxId)}`),
}

export const dialplanApi = {
  list: (pbxId: string) =>
    apiClient.get<DialplanData>(`/dialplan${q(pbxId)}`),
  getDetail: (pbxId: string, id: number) =>
    apiClient.get<DialplanDetail>(`/dialplan/${id}${q(pbxId)}`),
  listUsers: (pbxId: string) =>
    apiClient.get<{ users: PbxUser[] }>(`/dialplan/users${q(pbxId)}`),
}

export interface PbxUser {
  id: string
  name: string
  extension: string
}
