import { apiClient } from './client'

export interface BotTemplate {
  id: string
  name: string
  icon: string
  sector: string
  useCase: string
  sections: Array<{ key: string; title: string; content: string }>
  translations?: Record<string, {
    name: string
    sector: string
    useCase: string
    sections?: Array<{ key: string; title: string; content: string }>
  }>
  hasOverride?: boolean
  created?: string
  updated?: string
}

export type BotTemplateInput = Omit<BotTemplate, 'id' | 'created' | 'updated' | 'hasOverride'>

export const templatesApi = {
  list: () =>
    apiClient.get<BotTemplate[]>('/templates'),

  create: (data: BotTemplateInput) =>
    apiClient.post<BotTemplate>('/templates', data),

  update: (id: string, data: BotTemplateInput) =>
    apiClient.put<BotTemplate>(`/templates/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<void>(`/templates/${id}`),

  resetOverride: (id: string) =>
    apiClient.delete<{ ok: boolean }>(`/templates/${id}`),
}
