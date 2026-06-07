import PocketBase from 'pocketbase'
import type { RecordModel } from 'pocketbase'
import { env } from '../lib/env.js'
import { AppError } from '../lib/errors.js'

export type PbUser = RecordModel & {
  email: string
  name: string
  role: 'admin' | 'user'
}

// ── Admin client (singleton) ─────────────────────────────────────────────────
let _adminPb: PocketBase | null = null

export async function getAdminPb(): Promise<PocketBase> {
  if (_adminPb?.authStore.isValid) return _adminPb
  _adminPb = new PocketBase(env.POCKETBASE_URL)
  await _adminPb
    .collection('_superusers')
    .authWithPassword(env.POCKETBASE_ADMIN_EMAIL, env.POCKETBASE_ADMIN_PASSWORD)
  return _adminPb
}

// ── Verify a user Bearer token and return the user record ────────────────────
export async function getUserFromToken(token: string): Promise<PbUser> {
  const pb = new PocketBase(env.POCKETBASE_URL)
  pb.authStore.save(token, null)
  try {
    const { record } = await pb.collection('users').authRefresh()
    return record as PbUser
  } catch {
    throw new AppError(401, 'Token invalide ou expiré')
  }
}

// ── Authenticate a user with email/password ──────────────────────────────────
export async function loginUser(
  email: string,
  password: string,
): Promise<{ token: string; user: PbUser }> {
  const pb = new PocketBase(env.POCKETBASE_URL)
  try {
    const { token, record } = await pb
      .collection('users')
      .authWithPassword(email, password)
    return { token, user: record as PbUser }
  } catch {
    throw new AppError(401, 'Email ou mot de passe incorrect')
  }
}
