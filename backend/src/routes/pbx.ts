import { Hono } from 'hono'
import { getAdminPb } from '../services/pocketbase.js'
import { type AuthVariables } from '../middleware/auth.js'
import { AppError } from '../lib/errors.js'

type PbxInput = {
  name: string
  api_token: string
  pbx_serial?: string
  pbx_key?: string
  pbx_host: string
  pbx_local_token?: string
  shared?: boolean
}

const pbx = new Hono<{ Variables: AuthVariables }>()

// GET /pbx — PBX de l'utilisateur + PBX partagés
pbx.get('/', async (c) => {
  const user = c.get('user')
  const pb = await getAdminPb()

  if (user.role === 'admin') {
    const records = await pb.collection('pbx_credentials').getFullList({ sort: 'name' })
    return c.json(records)
  }

  // Non-admin: ses propres PBX + les PBX partagés
  const records = await pb.collection('pbx_credentials').getFullList({
    sort: 'name',
    filter: `user = "${user.id}" || shared = true`,
  })
  return c.json(records)
})

// POST /pbx — créer un PBX
pbx.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<PbxInput>()

  if (!body.name || !body.api_token || !body.pbx_host) {
    throw new AppError(400, 'name, api_token et pbx_host sont requis')
  }

  const pb = await getAdminPb()
  const record = await pb.collection('pbx_credentials').create({
    ...body,
    user: user.id,
    shared: user.role === 'admin' ? (body.shared ?? false) : false,
  })

  return c.json(record, 201)
})

// PUT /pbx/:id — mettre à jour un PBX
pbx.put('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json<Partial<PbxInput>>()

  const pb = await getAdminPb()
  const existing = await pb.collection('pbx_credentials').getOne(id).catch(() => null)

  if (!existing) throw new AppError(404, 'PBX introuvable')
  if (user.role !== 'admin' && existing['user'] !== user.id) throw new AppError(403, 'Accès refusé')

  const data: Partial<PbxInput> = { ...body }
  // Seul un admin peut modifier le flag shared
  if (user.role !== 'admin') delete data.shared

  const record = await pb.collection('pbx_credentials').update(id, data)
  return c.json(record)
})

// DELETE /pbx/:id — supprimer un PBX
pbx.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const pb = await getAdminPb()
  const existing = await pb.collection('pbx_credentials').getOne(id).catch(() => null)

  if (!existing) throw new AppError(404, 'PBX introuvable')
  if (user.role !== 'admin' && existing['user'] !== user.id) throw new AppError(403, 'Accès refusé')

  await pb.collection('pbx_credentials').delete(id)
  return c.body(null, 204)
})


// POST /pbx/test -- tester la connexion (avant ou apres sauvegarde)
pbx.post('/test', async (c) => {
  const body = await c.req.json<{
    pbx_host?: string
    api_token?: string
    pbx_local_token?: string
    type: 'api' | 'local'
  }>()

  if (body.type === 'api') {
    if (!body.api_token) throw new AppError(400, 'api_token requis')
    try {
      const res = await fetch('https://wim.wildix.com/v2/voicebots/bots', {
        headers: { Authorization: `Bearer ${body.api_token}` },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let msg = `HTTP ${res.status}`
        try { const j = JSON.parse(text); msg += ': ' + (j.message ?? j.error ?? text.slice(0, 80)) } catch { msg += text ? ': ' + text.slice(0, 80) : '' }
        return c.json({ ok: false, message: msg })
      }
      const data = await res.json() as { bots?: unknown[] }
      const count = Array.isArray(data.bots) ? data.bots.length : '?'
      return c.json({ ok: true, message: `Company API Key valide -- ${count} bot(s) accessible(s)` })
    } catch (e) {
      return c.json({ ok: false, message: String(e) })
    }
  }

  if (body.type === 'local') {
    if (!body.pbx_host || !body.pbx_local_token) throw new AppError(400, 'pbx_host et pbx_local_token requis')
    try {
      const res = await fetch(`https://${body.pbx_host}/api/v1/Colleagues/`, {
        headers: { Authorization: `Bearer ${body.pbx_local_token}` },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        return c.json({ ok: false, message: `HTTP ${res.status} -- token invalide ou acces refuse` })
      }
      const data = await res.json().catch(() => null) as Record<string, unknown> | null
      const arr = Array.isArray(data) ? data : Array.isArray(data?.['response']) ? data['response'] as unknown[] : null
      const count = arr ? arr.length : null
      return c.json({ ok: true, message: count !== null ? `PBX Simple Token valide -- ${count} colleague(s) trouve(s)` : 'PBX Simple Token valide' })
    } catch (e) {
      const msg = String(e)
      if (msg.includes('timeout') || msg.includes('abort')) return c.json({ ok: false, message: 'Timeout -- PBX inaccessible depuis ce serveur' })
      return c.json({ ok: false, message: msg })
    }
  }

  throw new AppError(400, 'type invalide (api | local)')
})

export { pbx as pbxRoutes }
