import { apiClient } from './client'
import type { AppUser } from '@/types/app'

export const usersApi = {
  list: () =>
    apiClient.get<AppUser[]>('/users'),

  create: (data: { email: string; password: string; name?: string; role?: 'admin' | 'user' }) =>
    apiClient.post<AppUser>('/users', data),

  update: (id: string, data: { name?: string; role?: 'admin' | 'user'; password?: string }) =>
    apiClient.put<AppUser>(`/users/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<void>(`/users/${id}`),
}
