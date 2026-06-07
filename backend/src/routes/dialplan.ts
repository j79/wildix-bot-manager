import { Hono } from 'hono'
import { getAdminPb } from '../services/pocketbase.js'
import { type AuthVariables } from '../middleware/auth.js'
import { AppError } from '../lib/errors.js'

const dialplan = new Hono<{ Variables: AuthVariables }>()

async function getPbxCreds(pbxId: string, userId: string, role: string) {
  const pb = await getAdminPb()
  const creds = await pb.collection('pbx_credentials').getOne(pbxId).catch(() => null)
  if (!creds) throw new AppError(404, 'PBX introuvable')
  if (role !== 'admin' && creds['user'] !== userId) throw new AppError(403, 'Acces refuse')
  return creds
}

// Try bare token first (Wildix PBX Simple Token format), then Bearer
async function pbxFetch(baseUrl: string, path: string, token: string): Promise<{ data: unknown; authUsed: string; error?: string }> {
  const url = `${baseUrl}${path}`
  for (const auth of [token, `Bearer ${token}`]) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: auth, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        return { data, authUsed: auth.startsWith('Bearer') ? 'Bearer' : 'plain' }
      }
      if (res.status === 404) {
        return { data: null, authUsed: '', error: `404 - endpoint not found: ${path}` }
      }
    } catch (e) {
      return { data: null, authUsed: '', error: String(e) }
    }
  }
  return { data: null, authUsed: '', error: 'Auth failed (tried plain token and Bearer)' }
}

// GET /dialplan?pbxId=xxx
dialplan.get('/', async (c) => {
  const user = c.get('user')
  const pbxId = c.req.query('pbxId')
  if (!pbxId) throw new AppError(400, 'pbxId requis')

  const creds = await getPbxCreds(pbxId, user.id, user.role)
  const host = creds['pbx_host'] as string
  const token = creds['pbx_local_token'] as string | undefined

  if (!host || !token) {
    return c.json({ dialplans: [], configured: false, debug: 'pbx_host or pbx_local_token missing' })
  }

  const baseUrl = `https://${host}/api/v1`

  const result = await pbxFetch(baseUrl, '/PBX/Dialplans/', token)
  let dialplans: unknown[] = []
  let dialplansError: string | null = null

  if (result.data !== null) {
    const data = result.data as Record<string, unknown>
    const records = (data?.result as Record<string, unknown>)?.records
    dialplans = Array.isArray(records) ? records : []
  } else {
    dialplansError = result.error ?? 'No data'
  }

  return c.json({
    configured: true,
    dialplans,
    errors: {
      dialplans: dialplans.length === 0 ? dialplansError : null,
    },
  })
})


// GET /dialplan/:id?pbxId=xxx — detail with numbers[]
dialplan.get('/:id', async (c) => {
  const user = c.get('user')
  const pbxId = c.req.query('pbxId')
  const id = c.req.param('id')
  if (!pbxId) throw new AppError(400, 'pbxId requis')

  const creds = await getPbxCreds(pbxId, user.id, user.role)
  const host = creds['pbx_host'] as string
  const token = creds['pbx_local_token'] as string | undefined

  if (!host || !token) throw new AppError(503, 'PBX non configure')

  const baseUrl = `https://${host}/api/v1`
  const result = await pbxFetch(baseUrl, `/PBX/Dialplans/${id}/`, token)

  if (result.data === null) throw new AppError(502, result.error ?? 'PBX inaccessible')

  const data = result.data as Record<string, unknown>
  const detail = (data?.result as Record<string, unknown>) ?? {}
  const numbers: unknown[] = Array.isArray(detail.numbers) ? detail.numbers : []

  return c.json({ id: detail.id, name: detail.name, description: detail.description, numbers })
})

// GET /dialplan/users?pbxId=xxx — utilisateurs PBX pour SendMessage
dialplan.get('/users', async (c) => {
  const user = c.get('user')
  const pbxId = c.req.query('pbxId')
  if (!pbxId) throw new AppError(400, 'pbxId requis')

  const creds = await getPbxCreds(pbxId, user.id, user.role)
  const host = creds['pbx_host'] as string
  const token = creds['pbx_local_token'] as string | undefined

  if (!host || !token) return c.json({ users: [] })

  const baseUrl = `https://${host}/api/v1`
  const result = await pbxFetch(baseUrl, '/PBX/Users/', token)

  if (result.data === null) return c.json({ users: [] })

  const data = result.data as Record<string, unknown>
  const records = (data?.result as Record<string, unknown>)?.records
  const rawUsers = Array.isArray(records) ? records as Record<string, unknown>[] : []

  const users = rawUsers
    .map(u => ({
      id:        String(u.id ?? u.user_id ?? u.extension ?? ''),
      name:      String(u.name ?? u.displayName ?? u.display_name ?? u.fullName ?? ''),
      extension: String(u.extension ?? u.number ?? u.id ?? ''),
    }))
    .filter(u => u.id)

  return c.json({ users })
})

export { dialplan as dialplanRoutes }
