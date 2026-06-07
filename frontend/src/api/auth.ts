import { apiClient } from './client'
import type { AppUser } from '@/types/app'

export interface LoginResponse {
  token: string
  user: AppUser
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { email, password }, { skipAuth: true }),

  logout: () =>
    apiClient.post<void>('/auth/logout', {}),

  me: () =>
    apiClient.get<AppUser>('/auth/me'),

  verifyPassword: (password: string) =>
    apiClient.post<{ valid: boolean }>('/auth/verify-password', { password }),
}
