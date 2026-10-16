/**
 * The PDF's only source: the original at NEUROS, fetched server-to-server for each authorized download and streamed
 * through, never written anywhere (no storage, no cache, no copy in this repository or its bundles). The request is
 * signed (HMAC-SHA256, shared secret, 2-minute clock window) per NEUROS's partner contract
 * (neuros-site: src/app/api/carte/partener/pdf, README "Partner book PDF").
 */
import 'server-only'
import { createHmac } from 'node:crypto'
import type { DigitalConfig } from '@/server/config'

export class SourceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/** The signed headers for one request (exported for tests). */
export function sourceHeaders(source: DigitalConfig['source'], reference: string, now = Date.now()) {
  const ts = String(Math.floor(now / 1000))
  const ref = reference.replace(/[^A-Za-z0-9-]/g, '').slice(0, 48) || 'biohacktech'
  const path = new URL(source.url).pathname
  const signature = createHmac('sha256', source.secret).update(`biohacktech\n${ts}\n${ref}\nGET\n${path}`).digest('hex')
  return { 'X-Neuros-Partner': 'biohacktech', 'X-Neuros-Timestamp': ts, 'X-Neuros-Reference': ref, 'X-Neuros-Signature': signature }
}

/** Opens the original PDF at NEUROS. The caller streams `body` to the customer; nothing is kept. */
export async function openSourcePdf(source: DigitalConfig['source'], reference: string): Promise<{ body: ReadableStream<Uint8Array>; size: number | null }> {
  let res: Response
  try {
    res = await fetch(source.url, { method: 'GET', headers: sourceHeaders(source, reference), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(25_000) })
  } catch (e) {
    throw new SourceError(`NEUROS indisponibil: ${e instanceof Error ? e.message : e}`, 0)
  }
  if (!res.ok || !res.body) {
    await res.body?.cancel().catch(() => {})
    throw new SourceError(`NEUROS a răspuns ${res.status}`, res.status)
  }
  if (!(res.headers.get('content-type') ?? '').startsWith('application/pdf')) {
    await res.body.cancel().catch(() => {})
    throw new SourceError('NEUROS nu a trimis un PDF', 502)
  }
  const size = Number(res.headers.get('content-length'))
  return { body: res.body, size: Number.isFinite(size) && size > 0 ? size : null }
}
