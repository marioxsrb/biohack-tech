/**
 * Exchange rates for the euro and dollar prices: the National Bank of Romania's daily reference rates (lei per
 * unit), with the European Central Bank's rates as a fallback (converted to lei through its RON rate). Read by the
 * fx.refresh job every 6 hours; a failure keeps the last rates.
 */
import 'server-only'
import type { Rates } from '@/lib/currency'

const BNR = 'https://curs.bnr.ro/nbrfxrates.xml'
const ECB = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'

export function parseBnr(xml: string): Rates | null {
  const date = /<Cube date="(\d{4}-\d{2}-\d{2})"/.exec(xml)?.[1]
  const rate = (c: string) => {
    const m = new RegExp(`currency="${c}"(?:\\s+multiplier="(\\d+)")?>([\\d.]+)<`).exec(xml)
    return m ? Number(m[2]) / Number(m[1] ?? 1) : NaN
  }
  const EUR = rate('EUR')
  const USD = rate('USD')
  return date && EUR > 0 && USD > 0 ? { EUR, USD, date } : null
}

export function parseEcb(xml: string): Rates | null {
  const date = /time='(\d{4}-\d{2}-\d{2})'/.exec(xml)?.[1]
  const rate = (c: string) => Number(new RegExp(`currency='${c}' rate='([\\d.]+)'`).exec(xml)?.[1])
  const ron = rate('RON')
  const usd = rate('USD')
  return date && ron > 0 && usd > 0 ? { EUR: ron, USD: Math.round((ron / usd) * 10_000) / 10_000, date } : null
}

export async function fetchRates(): Promise<Rates & { source: 'BNR' | 'ECB' }> {
  const get = async (url: string) => (await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'BiohackTech/1.0' } })).text()
  try {
    const r = parseBnr(await get(BNR))
    if (r) return { ...r, source: 'BNR' }
  } catch {}
  const r = parseEcb(await get(ECB))
  if (!r) throw new Error('no exchange rates from BNR or ECB')
  return { ...r, source: 'ECB' }
}
