import { Hono } from 'hono'
import { getAdminPb } from '../services/pocketbase.js'
import { AppError } from '../lib/errors.js'
import { type AuthVariables } from '../middleware/auth.js'

const trash = new Hono<{ Variables: AuthVariables }>()

// GET /trash?pbxId=xxx — liste les 10 derniers bots supprimés pour ce PBX
trash.get('/', async (c) => {
  const pbxId = c.req.query('pbxId')
  if (!pbxId) throw new AppError(400, 'pbxId requis')
  const pb = await getAdminPb()
  const result = await pb.collection('bot_trash').getList(1, 200, {
    sort: '-id',
  })
  const items = result.items
    .filter(r => r.pbx_id === pbxId)
    .slice(0, 10)
  return c.json(items.map(r => ({
    id: r.id,
    pbxId: r.pbx_id,
    botType: r.bot_type as 'voicebot' | 'chatbot',
    originalId: r.original_id,
    botName: r.bot_name,
    config: r.config_json,
    deletedBy: r.deleted_by,
    deletedAt: r.created,
  })))
})

// POST /trash — sauvegarde un bot avant suppression
trash.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{
    pbxId: string
    botType: 'voicebot' | 'chatbot'
    botId: string
    botName: string
    config: unknown
  }>()

  if (!body.pbxId || !body.botId || !body.botName || !body.config) {
    throw new AppError(400, 'pbxId, botId, botName et config sont requis')
  }

  const pb = await getAdminPb()

  // Garder seulement les 10 derniers pour ce PBX — filtrage en JS pour éviter les problèmes de filtre PocketBase
  try {
    const existing = await pb.collection('bot_trash').getList(1, 200, {
      sort: '-id',
    })
    const pbxItems = existing.items.filter(r => r.pbx_id === body.pbxId)
    for (const item of pbxItems.slice(9)) {
      await pb.collection('bot_trash').delete(item.id)
    }
  } catch {
    // purge non critique, on continue
  }

  const record = await pb.collection('bot_trash').create({
    pbx_id: body.pbxId,
    bot_type: body.botType,
    original_id: body.botId,
    bot_name: body.botName,
    config_json: body.config,
    deleted_by: user.email,
  })

  return c.json({ id: record.id })
})

// DELETE /trash/:id — suppression définitive de la corbeille
trash.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const pb = await getAdminPb()
  await pb.collection('bot_trash').delete(id)
  return c.json({ success: true })
})

export { trash as trashRoutes }
