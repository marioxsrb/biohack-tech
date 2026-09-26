/**
 * One small database interface over two engines:
 *   - PostgreSQL (DATABASE_URL), used in production;
 *   - PGlite, an embedded PostgreSQL under .data/ for development and QA, same SQL.
 * Migrations run automatically on first use, under an advisory lock.
 */
import 'server-only'
import { getConfig } from '@/server/config'
import { log } from '@/server/log'
import { migrations } from './migrations'

export type Row = Record<string, unknown>
export interface Queryable {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}
export interface Db extends Queryable {
  exec(sql: string): Promise<void>
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>
  close(): Promise<void>
}

export async function postgres(url: string): Promise<Db> {
  const { Pool } = await import('pg')
  const ssl = /sslmode=(require|verify)/.test(url) || process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined
  const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 5), ssl })
  pool.on('error', (e) => log.error('db.pool_error', { error: e.message }))
  return {
    query: (sql, params) => pool.query(sql, params as unknown[]) as never,
    exec: async (sql) => void (await pool.query(sql)),
    async tx(fn) {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const out = await fn({ query: (sql, params) => client.query(sql, params as unknown[]) as never })
        await client.query('commit')
        return out
      } catch (e) {
        await client.query('rollback').catch(() => {})
        throw e
      } finally {
        client.release()
      }
    },
    close: () => pool.end(),
  }
}

export async function pglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite')
  const db = dataDir ? await PGlite.create(dataDir) : await PGlite.create()
  // PGlite is a single connection: serialize transactions so they never interleave.
  let chain: Promise<unknown> = Promise.resolve()
  const q: Queryable = { query: (sql, params) => db.query(sql, params) as never }
  return {
    query: q.query,
    exec: async (sql) => void (await db.exec(sql)),
    tx(fn) {
      const run = chain.then(() => db.transaction((t) => fn({ query: (sql, params) => t.query(sql, params) as never })))
      chain = run.catch(() => {})
      return run
    },
    close: () => db.close(),
  }
}

export async function migrate(db: Db) {
  await db.exec('create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())')
  await db.tx(async (t) => {
    // Several app instances may boot at once; only one applies migrations.
    await t.query('select pg_advisory_xact_lock(727274)')
    const done = new Set((await t.query<{ id: string }>('select id from schema_migrations')).rows.map((r) => r.id))
    for (const m of migrations) {
      if (done.has(m.id)) continue
      for (const stmt of m.sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await t.query(stmt)
      await t.query('insert into schema_migrations (id) values ($1)', [m.id])
      log.info('db.migrated', { migration: m.id })
    }
  })
}

const g = globalThis as unknown as { __btDb?: Promise<Db> }

/** The shared database, migrated. Throws a clear error when no database is configured. */
export function getDb(): Promise<Db> {
  if (!g.__btDb) {
    const c = getConfig()
    g.__btDb = (async () => {
      const db = c.databaseUrl ? await postgres(c.databaseUrl) : c.localDb ? await pglite(process.env.LOCAL_DB_DIR ?? '.data/pglite') : null
      if (!db) throw new Error('DATABASE_URL is not configured')
      await migrate(db)
      return db
    })()
    g.__btDb.catch(() => (g.__btDb = undefined))
  }
  return g.__btDb
}

/** Test hook: use a specific database instance. */
export function setDb(db: Db | undefined) {
  g.__btDb = db ? Promise.resolve(db) : undefined
}
