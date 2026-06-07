import { apiClient } from './client'

export interface TrashedBot {
  id: string
  pbxId: string
  botType: 'voicebot' | 'chatbot'
  originalId: string
  botName: string
  config: unknown
  deletedBy: string
  deletedAt: string
}

export const trashApi = {
  list: (pbxId: string) =>
    apiClient.get<TrashedBot[]>(`/trash?pbxId=${pbxId}`),

  save: (data: {
    pbxId: string
    botType: 'voicebot' | 'chatbot'
    botId: string
    botName: string
    config: unknown
  }) => apiClient.post<{ id: string }>('/trash', data),

  remove: (id: string) =>
    apiClient.delete<void>(`/trash/${id}`),
}
