import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppUser } from '@/types/app'

interface AuthState {
  token: string | null
  user: AppUser | null
  isAuthenticated: boolean
  setAuth: (token: string, user: AppUser) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      clearAuth: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    { name: 'wilma-auth' },
  ),
)
