import { Hono } from 'hono'
import { getAdminPb } from '../services/pocketbase.js'
import { wilmaApi, xBeesApi, type PbxCredentials } from '../services/wildix.js'
import { type AuthVariables } from '../middleware/auth.js'
import { AppError } from '../lib/errors.js'

const bots = new Hono<{ Variables: AuthVariables }>()

// ── Helper : charge et vérifie l'accès aux credentials PBX ──────────────────
async function getPbxCreds(
  pbxId: string,
  userId: string,
  role: 'admin' | 'user',
): Promise<PbxCredentials> {
  const pb = await getAdminPb()
  const creds = await pb.collection('pbx_credentials').getOne(pbxId).catch(() => null)

  if (!creds) throw new AppError(404, 'PBX introuvable')
  if (role !== 'admin' && creds['user'] !== userId && !creds['shared']) throw new AppError(403, 'Accès refusé')

  return creds as unknown as PbxCredentials
}

function botApi(type: string) {
  return type === 'chatbot' ? xBeesApi : wilmaApi
}

// ── GET /bots?pbxId=xxx ── liste voicebots + chatbots ────────────────────────
bots.get('/', async (c) => {
  const user = c.get('user')
  const pbxId = c.req.query('pbxId')
  if (!pbxId) throw new AppError(400, 'pbxId requis')

  const creds = await getPbxCreds(pbxId, user.id, user.role)

  const [voicebots, chatbots] = await Promise.allSettled([
    wilmaApi.list(creds),
    xBeesApi.list(creds),
  ])

  if (voicebots.status === 'rejected') console.error('[bots] wilmaApi error:', voicebots.reason)
  if (chatbots.status  === 'rejected') console.error('[bots] xBeesApi error:', chatbots.reason)

  return c.json({
    voicebots: voicebots.status === 'fulfilled' ? voicebots.value : [],
    chatbots:  chatbots.status  === 'fulfilled' ? chatbots.value  : [],
    _errors: {
      voicebots: voicebots.status === 'rejected' ? String(voicebots.reason) : null,
      chatbots:  chatbots.status  === 'rejected' ? String(chatbots.reason)  : null,
    },
  })
})

// ── GET /bots/:id?pbxId=xxx&type=voicebot ────────────────────────────────────
bots.get('/:id', async (c) => {
  const user = c.get('user')
  const pbxId = c.req.query('pbxId')
  const type  = c.req.query('type') ?? 'voicebot'
  const id    = c.req.param('id')
  if (!pbxId) throw new AppError(400, 'pbxId requis')

  const creds = await getPbxCreds(pbxId, user.id, user.role)
  const bot = await botApi(type).get(creds, id)
  return c.json(bot)
})

// ── POST /bots?pbxId=xxx ── créer un bot ─────────────────────────────────────
bots.post('/', async (c) => {
  const user  = c.get('user')
  const pbxId = c.req.query('pbxId')
  const type  = c.req.query('type') ?? 'voicebot'
  if (!pbxId) throw new AppError(400, 'pbxId requis')

  const body  = await c.req.json()
  const creds = await getPbxCreds(pbxId, user.id, user.role)
  const bot   = await botApi(type).create(creds, body)
  return c.json(bot, 201)
})

// ── PUT /bots/:id?pbxId=xxx&type=voicebot ────────────────────────────────────
bots.put('/:id', async (c) => {
  const user  = c.get('user')
  const pbxId = c.req.query('pbxId')
  const type  = c.req.query('type') ?? 'voicebot'
  const id    = c.req.param('id')
  if (!pbxId) throw new AppError(400, 'pbxId requis')

  const body  = await c.req.json()
  const creds = await getPbxCreds(pbxId, user.id, user.role)
  const bot   = await botApi(type).update(creds, id, body)
  return c.json(bot)
})

// ── DELETE /bots/:id?pbxId=xxx&type=voicebot ─────────────────────────────────
bots.delete('/:id', async (c) => {
  const user  = c.get('user')
  const pbxId = c.req.query('pbxId')
  const type  = c.req.query('type') ?? 'voicebot'
  const id    = c.req.param('id')
  if (!pbxId) throw new AppError(400, 'pbxId requis')

  const creds = await getPbxCreds(pbxId, user.id, user.role)
  await botApi(type).delete(creds, id)
  return c.body(null, 204)
})

// ── POST /bots/:id/clone?pbxId=xxx ───────────────────────────────────────────
bots.post('/:id/clone', async (c) => {
  const user     = c.get('user')
  const srcPbxId = c.req.query('pbxId')
  const id       = c.req.param('id')
  const { targetPbxId, type = 'voicebot', cloneName } =
    await c.req.json<{ targetPbxId?: string; type?: string; cloneName?: string }>()

  if (!srcPbxId) throw new AppError(400, 'pbxId requis')

  const srcCreds = await getPbxCreds(srcPbxId, user.id, user.role)
  const dstCreds = targetPbxId && targetPbxId !== srcPbxId
    ? await getPbxCreds(targetPbxId, user.id, user.role)
    : srcCreds

  const api = botApi(type)
  const original = await api.get<Record<string, unknown>>(srcCreds, id)
  const { id: _id, createdAt: _c, updatedAt: _u, ...cloneData } = original
  cloneData.name = cloneName ?? `${String(cloneData.name ?? 'Bot')} (copie)`

  const clone = await api.create(dstCreds, cloneData)
  return c.json(clone, 201)
})

export { bots as botsRoutes }
