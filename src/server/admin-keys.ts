/**
 * API keys for the whole admin (/api/admin/v1), made in /admin/setari: "bt_live_<prefix>_<secret>", shown once,
 * stored only as a SHA-256 hash. Scope "read" answers GET requests only; "full" may also change orders, codes and
 * settings, with the same confirmations the admin pages ask for. A key can be revoked at once.
 */
import 'server-only'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Queryable } from '@/server/db'

export type KeyScope = 'read' | 'full'
export type AdminKey = { id: string; name: string; prefix: string; scope: KeyScope; createdAt: Date; lastUsedAt: Date | null; revokedAt: Date | null }

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const KEY_RE = /^bt_live_([a-z0-9]{8})_([A-Za-z0-9_-]{40,})$/

export const adminKeys = {
  async create(q: Queryable, name: string, scope: KeyScope) {
    const prefix = randomBytes(6).toString('hex').slice(0, 8)
    const token = `bt_live_${prefix}_${randomBytes(32).toString('base64url')}`
    const id = randomUUID()
    await q.query('insert into admin_api_keys (id, name, prefix, key_hash, scope) values ($1, $2, $3, $4, $5)', [id, name.slice(0, 60) || 'Cheie API', prefix, hash(token), scope])
    return { id, token, prefix }
  },

  async list(q: Queryable): Promise<AdminKey[]> {
    const { rows } = await q.query('select * from admin_api_keys order by revoked_at nulls first, created_at desc')
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      prefix: r.prefix as string,
      scope: r.scope as KeyScope,
      createdAt: new Date(r.created_at as string),
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at as string) : null,
      revokedAt: r.revoked_at ? new Date(r.revoked_at as string) : null,
    }))
  },

  async revoke(q: Queryable, id: string) {
    const { rows } = await q.query('update admin_api_keys set revoked_at = now() where id = $1 and revoked_at is null returning id', [id])
    return rows.length > 0
  },

  /** The key behind a bearer token, when valid and not revoked (its last use is recorded). */
  async verify(q: Queryable, token: string): Promise<{ id: string; name: string; scope: KeyScope } | null> {
    if (!KEY_RE.test(token)) return null
    const { rows } = await q.query<{ id: string; name: string; scope: KeyScope }>(
      'update admin_api_keys set last_used_at = now() where key_hash = $1 and revoked_at is null returning id, name, scope',
      [hash(token)],
    )
    return rows[0] ?? null
  },
}
