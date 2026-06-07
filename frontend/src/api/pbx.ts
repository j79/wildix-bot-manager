import { apiClient } from './client'
import type { PbxCredential } from '@/types/app'

type PbxInput = Omit<PbxCredential, 'id' | 'user' | 'created' | 'updated'>

export const pbxApi = {
  list:   ()                         => apiClient.get<PbxCredential[]>('/pbx'),
  create: (data: PbxInput)           => apiClient.post<PbxCredential>('/pbx', data),
  update: (id: string, data: Partial<PbxInput>) => apiClient.put<PbxCredential>(`/pbx/${id}`, data),
  delete: (id: string)               => apiClient.delete<void>(`/pbx/${id}`),
  test: (data: { pbx_host?: string; api_token?: string; pbx_local_token?: string; type: 'api' | 'local' }) =>
    apiClient.post<{ ok: boolean; message: string }>('/pbx/test', data),
}
