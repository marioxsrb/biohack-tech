/** Small in-memory fixed-window limiter per key (per instance). Enough to blunt scripted abuse of checkout. */
import 'server-only'

const hits = new Map<string, { n: number; reset: number }>()

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs })
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
    return true
  }
  h.n++
  return h.n <= max
}

export const clientIp = (headers: Headers) => headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
