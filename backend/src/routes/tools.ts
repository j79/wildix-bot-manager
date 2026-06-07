import { Hono } from 'hono'
import { getAdminPb } from '../services/pocketbase.js'
import { wimToolsApi, type PbxCredentials } from '../services/wildix.js'
import { type AuthVariables } from '../middleware/auth.js'
import { AppError } from '../lib/errors.js'

const tools = new Hono<{ Variables: AuthVariables }>()

async function getPbxCreds(
  pbxId: string,
  userId: string,
  role: 'admin' | 'user',
): Promise<PbxCredentials> {
  const pb = await getAdminPb()
  const creds = await pb.collection('pbx_credentials').getOne(pbxId).catch(() => null)

  if (!creds) throw new AppError(404, 'PBX introuvable')
  if (role !== 'admin' && creds['user'] !== userId) throw new AppError(403, 'Accès refusé')

  return creds as unknown as PbxCredentials
}

// GET /tools?pbxId=xxx
tools.get('/', async (c) => {
  const user = c.get('user')
  const pbxId = c.req.query('pbxId')
  if (!pbxId) throw new AppError(400, 'pbxId requis')

  const creds = await getPbxCreds(pbxId, user.id, user.role)
  const list = await wimToolsApi.list(creds)
  return c.json(list)
})

// POST /tools?pbxId=xxx
tools.post('/', async (c) => {
  const user = c.get('user')
  const pbxId = c.req.query('pbxId')
  if (!pbxId) throw new AppError(400, 'pbxId requis')

  const body = await c.req.json()
  const creds = await getPbxCreds(pbxId, user.id, user.role)
  const tool = await wimToolsApi.create(creds, body)
  return c.json(tool, 201)
})

// PUT /tools/:id?pbxId=xxx
tools.put('/:id', async (c) => {
  const user = c.get('user')
  const pbxId = c.req.query('pbxId')
  const id = c.req.param('id')
  if (!pbxId) throw new AppError(400, 'pbxId requis')

  const body = await c.req.json()
  const creds = await getPbxCreds(pbxId, user.id, user.role)
  const tool = await wimToolsApi.update(creds, id, body)
  return c.json(tool)
})

// DELETE /tools/:id?pbxId=xxx
tools.delete('/:id', async (c) => {
  const user = c.get('user')
  const pbxId = c.req.query('pbxId')
  const id = c.req.param('id')
  if (!pbxId) throw new AppError(400, 'pbxId requis')

  const creds = await getPbxCreds(pbxId, user.id, user.role)
  await wimToolsApi.delete(creds, id)
  return c.body(null, 204)
})

export { tools as toolsRoutes }
