import { Hono } from 'hono'
import { loginUser } from '../services/pocketbase.js'
import { requireAuth, type AuthVariables } from '../middleware/auth.js'
import { AppError } from '../lib/errors.js'

const auth = new Hono<{ Variables: AuthVariables }>()

// POST /auth/login
auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()
  if (!email || !password) return c.json({ error: 'Email et mot de passe requis' }, 400)
  const { token, user } = await loginUser(email, password)
  return c.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
})

// POST /auth/logout
auth.post('/logout', requireAuth, (c) => c.json({ message: 'Déconnecté' }))

// GET /auth/me
auth.get('/me', requireAuth, (c) => {
  const user = c.get('user')
  return c.json({ id: user.id, email: user.email, name: user.name, role: user.role })
})

// POST /auth/verify-password — vérifie le mot de passe de l'utilisateur connecté
// Retourne toujours 200 (jamais 401) pour ne pas déclencher le logout automatique côté client
auth.post('/verify-password', requireAuth, async (c) => {
  const user = c.get('user')
  const { password } = await c.req.json<{ password: string }>()
  if (!password) throw new AppError(400, 'Mot de passe requis')
  try {
    await loginUser(user.email, password)
    return c.json({ valid: true })
  } catch {
    return c.json({ valid: false })
  }
})

export { auth as authRoutes }
