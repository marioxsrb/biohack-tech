import { NextResponse, type NextRequest } from 'next/server'
import { site } from '@/config/site'
import { sanitizeAttribution } from '@/lib/attribution'
import { normalizeEnquiry, validateEnquiry } from '@/lib/enquiry'
import { recordEnquiry } from '@/server/enquiries'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'

const MAX_BODY = 16_000

/**
 * The contact form. Validated here again, stored in our database, then copied to the CRM by the outbox.
 * Spam: a hidden field bots fill in, a minimum time on the page, and a per-address rate limit. A bot gets
 * the same "sent" answer as a person, so it learns nothing.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`contact:${clientIp(req.headers)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: 'RATE_LIMIT', message: 'Ai trimis deja câteva mesaje. Încearcă din nou peste câteva minute.' }, { status: 429 })
  }
  const raw = await req.text()
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'TOO_LARGE', message: 'Mesajul este prea lung.' }, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST', message: 'Cererea nu este validă. Reîncarcă pagina.' }, { status: 400 })
  }

  const startedAt = Number(body.startedAt)
  const bot = (typeof body.website === 'string' && body.website.length > 0) || !Number.isFinite(startedAt) || Date.now() - startedAt < 2500
  if (bot) {
    log.warn('enquiry.spam_dropped')
    return NextResponse.json({ ok: true, reference: 'MSG-OK' })
  }

  const enquiry = normalizeEnquiry(body)
  const fields = validateEnquiry(enquiry)
  if (Object.keys(fields).length) return NextResponse.json({ error: 'INVALID', message: 'Verifică câmpurile marcate.', fields }, { status: 422 })

  const attemptId = typeof body.attemptId === 'string' && /^[\w-]{8,64}$/.test(body.attemptId) ? body.attemptId : crypto.randomUUID()
  const page = typeof body.page === 'string' && /^\/[\w\-/]{0,120}$/.test(body.page) ? body.page : null
  try {
    const { enquiry: saved } = await recordEnquiry(enquiry, { attemptId, sourcePage: page, attribution: sanitizeAttribution(body.attribution, new URL(site.url).host) })
    kickJobs()
    return NextResponse.json({ ok: true, reference: saved.reference })
  } catch (e) {
    log.error('enquiry.failed', { error: errText(e) })
    return NextResponse.json({ error: 'SERVER', message: `Mesajul nu a putut fi trimis. Scrie-ne direct la ${site.email}.` }, { status: 500 })
  }
}
