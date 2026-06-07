import { Hono } from 'hono'
import { getAdminPb } from '../services/pocketbase.js'
import { type AuthVariables } from '../middleware/auth.js'
import { AppError } from '../lib/errors.js'

const templates = new Hono<{ Variables: AuthVariables }>()

// GET /templates
templates.get('/', async (c) => {
  const pb = await getAdminPb()
  const records = await pb.collection('bot_templates').getFullList({ sort: 'name' })
  return c.json(records)
})

// POST /templates
templates.post('/', async (c) => {
  const body = await c.req.json()
  if (!body.name?.trim()) throw new AppError(400, 'name est requis')
  const pb = await getAdminPb()
  const record = await pb.collection('bot_templates').create({
    name:         body.name.trim(),
    icon:         body.icon         ?? '🤖',
    sector:       body.sector       ?? '',
    useCase:      body.useCase      ?? '',
    sections:     body.sections     ?? [],
    translations: body.translations ?? {},
  })
  return c.json(record)
})

// PUT /templates/:id
templates.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const pb = await getAdminPb()
  const record = await pb.collection('bot_templates').update(id, {
    name:         body.name?.trim(),
    icon:         body.icon,
    sector:       body.sector,
    useCase:      body.useCase,
    sections:     body.sections,
    translations: body.translations ?? {},
  })
  return c.json(record)
})

// DELETE /templates/:id
templates.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const pb = await getAdminPb()
  await pb.collection('bot_templates').delete(id)
  return c.json({ ok: true })
})

export { templates as templatesRoutes }
