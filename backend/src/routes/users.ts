import { Hono } from 'hono'
import { getAdminPb } from '../services/pocketbase.js'
import { type AuthVariables } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/auth.js'
import { AppError } from '../lib/errors.js'

const users = new Hono<{ Variables: AuthVariables }>()

// Toutes les routes /users requièrent le rôle admin
users.use('*', requireAdmin)

// ── GET /users ── liste tous les utilisateurs ─────────────────────────────────
users.get('/', async (c) => {
  const pb = await getAdminPb()
  const records = await pb.collection('users').getFullList({ sort: 'email' })
  return c.json(records)
})

// ── POST /users ── créer un utilisateur ───────────────────────────────────────
users.post('/', async (c) => {
  const body = await c.req.json<{
    email: string
    password: string
    name?: string
    role?: 'admin' | 'user'
  }>()

  if (!body.email || !body.password) {
    throw new AppError(400, 'email et password sont requis')
  }

  const pb = await getAdminPb()
  const record = await pb.collection('users').create({
    email: body.email,
    password: body.password,
    passwordConfirm: body.password,
    name: body.name ?? '',
    role: body.role ?? 'user',
    emailVisibility: true,
  })

  return c.json(record, 201)
})

// ── PUT /users/:id ── modifier rôle / nom ─────────────────────────────────────
users.put('/:id', async (c) => {
  const id   = c.req.param('id')
  const self = c.get('user')
  const body = await c.req.json<{ name?: string; role?: 'admin' | 'user'; password?: string }>()

  if (id === self.id && body.role && body.role !== self.role) {
    throw new AppError(400, 'Vous ne pouvez pas modifier votre propre rôle')
  }

  const pb = await getAdminPb()
  const existing = await pb.collection('users').getOne(id).catch(() => null)
  if (!existing) throw new AppError(404, 'Utilisateur introuvable')

  const update: Record<string, unknown> = {}
  if (body.name !== undefined)     update.name     = body.name
  if (body.role !== undefined)     update.role     = body.role
  if (body.password)               { update.password = body.password; update.passwordConfirm = body.password }

  const record = await pb.collection('users').update(id, update)
  return c.json(record)
})

// ── DELETE /users/:id ─────────────────────────────────────────────────────────
users.delete('/:id', async (c) => {
  const id   = c.req.param('id')
  const self = c.get('user')

  if (id === self.id) throw new AppError(400, 'Vous ne pouvez pas supprimer votre propre compte')

  const pb = await getAdminPb()
  const existing = await pb.collection('users').getOne(id).catch(() => null)
  if (!existing) throw new AppError(404, 'Utilisateur introuvable')

  await pb.collection('users').delete(id)
  return c.body(null, 204)
})

export { users as usersRoutes }
