import { createMiddleware } from 'hono/factory'
import { getUserFromToken, type PbUser } from '../services/pocketbase.js'

export type AuthVariables = {
  user: PbUser
  token: string
}

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const header = c.req.header('Authorization')
    if (!header?.startsWith('Bearer ')) {
      return c.json({ error: 'Authentification requise' }, 401)
    }
    const token = header.slice(7)
    const user = await getUserFromToken(token)
    c.set('user', user)
    c.set('token', token)
    await next()
  },
)

export const requireAdmin = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const user = c.get('user')
    if (user?.role !== 'admin') {
      return c.json({ error: 'Accès réservé aux administrateurs' }, 403)
    }
    await next()
  },
)
