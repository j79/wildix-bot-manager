import { Hono } from 'hono'
import { getAdminPb } from '../services/pocketbase.js'
import { type AuthVariables } from '../middleware/auth.js'
import { AppError } from '../lib/errors.js'

const templates = new Hono<{ Variables: AuthVariables }>()

// GET /templates — templates maîtres + overrides utilisateur fusionnés
templates.get('/', async (c) => {
  const user = c.get('user')
  const pb = await getAdminPb()

  const masters = await pb.collection('bot_templates').getFullList({ sort: 'name' })

  // Récupérer les overrides de l'utilisateur
  const overrides = await pb.collection('user_template_overrides')
    .getFullList({ filter: `user = "${user.id}"` })
    .catch(() => [] as any[])

  const overrideMap = new Map(overrides.map((o: any) => [o['template'] as string, o]))

  const result = masters.map((m: any) => {
    const ov = overrideMap.get(m.id)
    if (!ov) return { ...m, hasOverride: false }
    return {
      ...m,
      name:         ov['name']         ?? m.name,
      icon:         ov['icon']         ?? m.icon,
      sector:       ov['sector']       ?? m.sector,
      useCase:      ov['useCase']      ?? m.useCase,
      sections:     ov['sections']?.length ? ov['sections'] : m.sections,
      translations: ov['translations'] ?? m.translations,
      hasOverride:  true,
    }
  })

  return c.json(result)
})

// POST /templates — admin only : créer un template maître
templates.post('/', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') throw new AppError(403, 'Seuls les administrateurs peuvent créer des templates maîtres')

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

// PUT /templates/:id — admin: modifie maître ; user: crée/met à jour son override
templates.put('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json()
  const pb = await getAdminPb()

  const master = await pb.collection('bot_templates').getOne(id).catch(() => null)
  if (!master) throw new AppError(404, 'Template introuvable')

  if (user.role === 'admin') {
    const record = await pb.collection('bot_templates').update(id, {
      name:         body.name?.trim(),
      icon:         body.icon,
      sector:       body.sector,
      useCase:      body.useCase,
      sections:     body.sections,
      translations: body.translations ?? {},
    })
    return c.json(record)
  }

  // Non-admin: upsert override
  const existing = await pb.collection('user_template_overrides')
    .getFirstListItem(`user = "${user.id}" && template = "${id}"`)
    .catch(() => null)

  const overrideData = {
    user:         user.id,
    template:     id,
    name:         body.name?.trim()  ?? master['name'],
    icon:         body.icon          ?? master['icon'],
    sector:       body.sector        ?? master['sector'],
    useCase:      body.useCase       ?? master['useCase'],
    sections:     body.sections      ?? master['sections'],
    translations: body.translations  ?? master['translations'] ?? {},
  }

  const record = existing
    ? await pb.collection('user_template_overrides').update(existing.id, overrideData)
    : await pb.collection('user_template_overrides').create(overrideData)

  return c.json({ ...master, ...record, hasOverride: true })
})

// DELETE /templates/:id — admin: supprime le maître ; user: supprime son override (reset)
templates.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const pb = await getAdminPb()

  if (user.role === 'admin') {
    // Supprimer le maître + tous les overrides associés
    const overrides = await pb.collection('user_template_overrides')
      .getFullList({ filter: `template = "${id}"` })
      .catch(() => [] as any[])
    await Promise.all(overrides.map((o: any) => pb.collection('user_template_overrides').delete(o.id)))
    await pb.collection('bot_templates').delete(id)
    return c.json({ ok: true })
  }

  // Non-admin: supprimer uniquement son override (retour au maître)
  const override = await pb.collection('user_template_overrides')
    .getFirstListItem(`user = "${user.id}" && template = "${id}"`)
    .catch(() => null)

  if (!override) throw new AppError(404, 'Aucun override trouvé pour ce template')
  await pb.collection('user_template_overrides').delete(override.id)
  return c.json({ ok: true })
})

export { templates as templatesRoutes }
