import type { NextRequest } from 'next/server'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { blockFor } from '@/server/digital/delivery'
import { entitlements, ipHash } from '@/server/digital/entitlements'
import { readLink } from '@/server/digital/links'
import { openSourcePdf, SourceError } from '@/server/digital/source'
import { errText, log } from '@/server/log'
import { orders } from '@/server/orders/repository'
import { clientIp, rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Per entitlement: at most this many downloads an hour, and this many in all (then a person helps). */
const PER_HOUR = 8
const LIFETIME = 40
const FILE_NAME = 'Stiu-Vreau-De-Ce-Nu-Pot-Diana-L-Palotas.pdf'

const PRIVATE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }

/** A short page for a person who clicked a link that cannot work (no detail about why beyond what helps them). */
function page(status: number, title: string, text: string) {
  const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f2f5f6;color:#27343a}main{max-width:520px;margin:12vh auto;padding:32px;background:#fff;border-radius:20px}h1{font-size:22px;color:#0b1316;margin:0 0 12px}p{font-size:16px;line-height:1.6;margin:0 0 12px}a{color:#0e7490}</style></head>
<body><main><h1>${title}</h1><p>${text}</p><p>Biohack Tech · <a href="mailto:contact@biohack-tech.ro">contact@biohack-tech.ro</a></p></main></body></html>`
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...PRIVATE } })
}

const EXPIRED = () =>
  page(410, 'Linkul a expirat', 'Din motive de securitate, linkurile pentru PDF expiră. Deschide pagina comenzii pentru un link nou sau scrie-ne și îți trimitem altul. / This link has expired: open your order page for a new one.')
const INVALID = () => page(403, 'Link invalid', 'Linkul nu este valid. Folosește butonul din pagina comenzii sau din emailul primit. / This link is not valid.')
const CLOSED = () => page(403, 'Acces indisponibil', 'Accesul la versiunea PDF nu este disponibil pentru această comandă. Scrie-ne dacă ai întrebări. / Access to the PDF is not available for this order.')
const LIMIT = () => page(429, 'Prea multe descărcări', 'Ai descărcat cartea de mai multe ori într-un timp scurt. Încearcă din nou mai târziu sau scrie-ne. / Too many downloads, please try again later.')
const UNAVAILABLE = () => page(503, 'Încearcă din nou', 'Nu am putut pregăti PDF-ul acum. Încearcă din nou în câteva minute. / The PDF could not be prepared right now, please try again in a few minutes.')

/**
 * The book's PDF, for an authorized customer only. The signed link only says which entitlement is asked for; this
 * route then checks, every time: the signature and expiry, the entitlement (active, same link version), the order
 * (paid, or delivered for cash on delivery, not cancelled or refunded), and the limits. The file is fetched from
 * NEUROS for this request and streamed through: it is never stored, cached or public. Each attempt is audited.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers)
  if (!rateLimit(`digital:${ip}`, 30, 10 * 60_000)) return LIMIT()
  const c = getConfig()
  if (!c.digital) return UNAVAILABLE()
  const token = req.nextUrl.searchParams.get('t') ?? ''
  const link = readLink(c.digital.linkSecret, token)
  if (!link.ok) return link.reason === 'expired' ? EXPIRED() : INVALID()

  const db = await getDb()
  const e = await entitlements.byId(db, link.claims.entitlementId)
  if (!e) return INVALID()
  const audit = (type: string, details: Record<string, unknown> = {}) =>
    entitlements
      .event(db, { entitlementId: e.id, orderId: e.orderId, type, actor: 'customer', details: { channel: link.claims.channel, ...details }, ipHash: ipHash(ip, c.digital!.linkSecret) })
      .catch((err) => log.error('digital.audit_failed', { error: errText(err) }))

  // A link from before a revocation or a regeneration carries an old version: it is dead.
  if (e.linkVersion !== link.claims.version) {
    await audit('download.denied', { reason: 'old_link' })
    return CLOSED()
  }
  const o = await orders.byId(db, e.orderId)
  const block = o ? blockFor(o, e, c) : { reason: 'no_book' as const, text: '' }
  if (!o || block) {
    await audit('download.denied', { reason: block?.reason ?? 'order_gone' })
    return CLOSED()
  }
  if (e.downloads >= LIFETIME || (await entitlements.downloadsSince(db, e.id, new Date(Date.now() - 3_600_000))) >= PER_HOUR) {
    await audit('download.denied', { reason: 'limit' })
    return LIMIT()
  }

  let pdf
  try {
    pdf = await openSourcePdf(c.digital.source, o.orderNumber)
  } catch (err) {
    await audit('download.failed', { error: err instanceof SourceError ? `source ${err.status}` : errText(err).slice(0, 120) })
    log.error('digital.source_failed', { orderNumber: o.orderNumber, error: errText(err) })
    return UNAVAILABLE()
  }
  await db.query('update digital_entitlements set downloads = downloads + 1, last_download_at = now(), updated_at = now() where id = $1', [e.id])
  await audit('download.ok')
  log.info('digital.download', { orderNumber: o.orderNumber, channel: link.claims.channel })
  return new Response(pdf.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${FILE_NAME}"`,
      ...(pdf.size && { 'Content-Length': String(pdf.size) }),
      ...PRIVATE,
    },
  })
}
