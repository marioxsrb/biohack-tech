import { NextResponse } from 'next/server'
import { loadConfig, paymentMethods } from '@/server/config'
import { getDb } from '@/server/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Liveness + readiness without secrets: 200 when orders can be taken, 503 otherwise. */
export async function GET() {
  const { config, issues } = loadConfig()
  let database = false
  try {
    await (await getDb()).query('select 1')
    database = true
  } catch {}
  const methods = paymentMethods(config)
  const ready = database && (methods.card || methods.transfer)
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
