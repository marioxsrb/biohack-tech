#!/usr/bin/env node
/**
 * Applies database migrations to DATABASE_URL (the app also does this on first use).
 * Usage: DATABASE_URL=postgres://... npm run db:migrate
 * Requires Node 22.18+ (imports the TypeScript migration list directly).
 */
import pg from 'pg'
import { migrations } from '../src/server/db/migrations.ts'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}
const ssl = /sslmode=(require|verify)/.test(url) || process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined
const client = new pg.Client({ connectionString: url, ssl })
await client.connect()
try {
  await client.query('create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())')
  await client.query('begin')
  await client.query('select pg_advisory_xact_lock(727274)')
  const done = new Set((await client.query('select id from schema_migrations')).rows.map((r) => r.id))
  for (const m of migrations) {
    if (done.has(m.id)) {
      console.log(`= ${m.id}`)
      continue
    }
    for (const stmt of m.sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await client.query(stmt)
    await client.query('insert into schema_migrations (id) values ($1)', [m.id])
    console.log(`+ ${m.id}`)
  }
  await client.query('commit')
} catch (e) {
  await client.query('rollback').catch(() => {})
  console.error(e)
  process.exitCode = 1
} finally {
  await client.end()
}
