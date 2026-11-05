/**
 * The store's price rules for "Cumpără în rate" (lib/tbi.ts), read from the theme's tbi-data view
 * (product.tbi-data.liquid). Kept 10 minutes; when the store does not answer, the last good copy is used,
 * and without any copy the request falls back to the total the page showed (if it is believable).
 */
import 'server-only'
import type { TbiPriceRules } from '@/lib/tbi'
import { errText, log } from '@/server/log'

const TTL = 10 * 60_000
let cache: { at: number; rules: TbiPriceRules } | null = null

function valid(x: unknown): x is TbiPriceRules {
  const p = (x as TbiPriceRules)?.products
  return !!p && typeof p === 'object' && Object.values(p).every((r) => typeof r?.title === 'string' && Number.isFinite(r?.price) && r.price > 0)
}

/** The rules, or null when the store never answered with a valid copy. */
export async function tbiPriceRules(url: string, now = Date.now()): Promise<TbiPriceRules | null> {
  if (cache && now - cache.at < TTL) return cache.rules
  let why = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        // A plain page request: Shopify throttles requests that ask for JSON like an API client.
        headers: { accept: 'text/html,*/*', 'user-agent': 'Mozilla/5.0 (compatible; biohack-tech-rate-tbi/1.0; +https://biohack-tech.ro)' },
        cache: 'no-store',
        signal: AbortSignal.timeout(6000),
      })
      const body = await res.text()
      let json: unknown = null
      try {
        json = JSON.parse(body)
      } catch {}
      if (res.ok && valid(json)) {
        cache = { at: now, rules: json }
        lastStatus = { ok: true, at: now, note: 'live' }
        return json
      }
      why = `HTTP ${res.status}: ${body.slice(0, 120).replace(/\s+/g, ' ')}`
    } catch (e) {
      why = errText(e)
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 400))
  }
  log.warn('rate_tbi.prices_unavailable', { error: why, cached: !!cache })
  lastStatus = { ok: !!cache, at: now, note: why }
  return cache?.rules ?? null
}

let lastStatus: { ok: boolean; at: number; note: string } | null = null
/** For GET /api/rate-tbi: can the server read the store's prices, and when did it last try. */
export const tbiPriceStatus = () => ({ ...lastStatus, cachedAt: cache?.at ?? null })

/** Test helper. */
export const resetTbiPrices = () => {
  cache = null
}
