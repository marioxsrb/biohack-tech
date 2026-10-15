import { NextResponse, type NextRequest } from 'next/server'
import { isGatedHost, normalizeContact, validateContact } from '@/lib/lead'
import { getDb } from '@/server/db'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { welcomeSignup } from '@/server/welcome'

export const runtime = 'nodejs'

/** The website's 10% popup: the address gets the code by email (server/welcome.ts). Not on acces. */
export async function POST(req: NextRequest) {
  if (isGatedHost(req.headers.get('host'))) return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 404 })
  if (!rateLimit(`welcome:${clientIp(req.headers)}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'RATE_LIMIT', message: 'Prea multe încercări. Încearcă mai târziu.' }, { status: 429 })
  const raw = await req.text()
  if (raw.length > 2_000) return NextResponse.json({ error: 'TOO_LARGE' }, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }
  // A filled hidden field is a bot: answered like a success, nothing recorded.
  if (typeof body.website === 'string' && body.website) return NextResponse.json({ ok: true })
  const { email } = normalizeContact({ email: typeof body.email === 'string' ? body.email : '' })
  if (validateContact({ name: '', email, phone: '' }, ['email']).email) return NextResponse.json({ error: 'INVALID', message: 'Verifică adresa de email.' }, { status: 422 })
  try {
    const db = await getDb()
    const r = await db.tx((t) => welcomeSignup(t, email, typeof body.page === 'string' ? body.page : null))
    kickJobs()
    log.info('welcome.signup', { created: r.created })
    return NextResponse.json({ ok: true })
  } catch (e) {
    log.error('welcome.failed', { error: errText(e) })
    return NextResponse.json({ error: 'SERVER', message: 'Nu am putut trimite codul. Încearcă din nou.' }, { status: 500 })
  }
}
