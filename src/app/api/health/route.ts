import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, checkAdminSession } from '@/lib/admin-auth'
import { loadConfig, paymentMethods } from '@/server/config'
import { getDb } from '@/server/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Liveness + readiness without secrets: 200 when orders can be taken, 503 otherwise. Which providers the shop
 * uses (and what is misconfigured) is shown only to a signed-in admin.
 */
export async function GET(req: NextRequest) {
  const { config, issues } = loadConfig()
  let database = false
  try {
    await (await getDb()).query('select 1')
    database = true
  } catch {}
  const methods = paymentMethods(config)
  const ready = database && (methods.card || methods.transfer)
  const admin = (await checkAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) === 'ok'
  if (!admin) return NextResponse.json({ ok: ready, database, payments: methods }, { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(
    {
      ok: ready,
      env: config.appEnv,
      database,
      payments: methods,
      integrations: {
        stripe: !!config.stripe,
        fgo: !!config.fgo,
        ghl: !!config.ghl,
        email: config.email.transport,
        notifications: !!config.email.notifyTo && (config.email.transport === 'smtp' || config.email.transport === 'file'),
      },
      errors: issues.filter((i) => i.level === 'error').map((i) => i.area),
    },
    { status: ready ? 200 : 503 },
  )
}
