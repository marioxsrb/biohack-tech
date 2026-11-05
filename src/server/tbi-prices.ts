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
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'biohack-tech-rate-tbi/1.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json: unknown = await res.json()
    if (!valid(json)) throw new Error('invalid price rules')
    cache = { at: now, rules: json }
    return json
  } catch (e) {
    log.warn('rate_tbi.prices_unavailable', { error: errText(e), cached: !!cache })
    return cache?.rules ?? null
  }
}

/** Test helper. */
export const resetTbiPrices = () => {
  cache = null
}
