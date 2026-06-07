export type UserRole = 'admin' | 'user'

export interface AppUser {
  id: string
  email: string
  name: string
  role: UserRole
}

export interface PbxCredential {
  id: string
  user: string
  name: string
  api_token: string
  pbx_serial: string
  pbx_host: string
  pbx_local_token: string
  created: string
  updated: string
}

export interface AuditLog {
  id: string
  user: string
  action: string
  details: Record<string, unknown>
  created: string
}
