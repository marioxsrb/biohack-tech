import { NextResponse, type NextRequest } from 'next/server'
import { getCalculations, quoteSchemes } from '@/lib/tbi/client'
import { getConfig } from '@/server/config'
import { errText, log } from '@/server/log'

export const runtime = 'nodejs'

const ORIGINS = new Set(['https://biohack-tech.ro', 'https://www.biohack-tech.ro', 'https://t06dig-ta.myshopify.com'])

function cors(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', Vary: 'Origin' } : { Vary: 'Origin' }
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) })
}

/**
 * GET /api/tbi/calculations[?amount=3900]: TBI Fusion Pay's repayment schemes (GetCalculations, cached 24 hours on
 * the server; the last known list when TBI does not answer). With an amount, the schemes that finance it and their
 * monthly instalment, (amount + analysis_fee) × installment_factor, and total. ok:false when TBI is off or never
 * answered: the store's simulator then keeps its own formula. env says whether the schemes are TBI's test ones.
 */
export async function GET(req: NextRequest) {
  const h = { ...cors(req), 'cache-control': 'public, max-age=300' }
  const t = getConfig().tbi
  if (!t) return NextResponse.json({ ok: false, reason: 'not_configured' }, { headers: h })
  const amount = Number(req.nextUrl.searchParams.get('amount'))
  try {
    const { schemes, cachedAt, stale } = await getCalculations(t)
    const hasAmount = Number.isFinite(amount) && amount > 0
    // ?only=quotes (the store's simulator): just the quotes for the amount, without the full scheme list.
    if (hasAmount && req.nextUrl.searchParams.get('only') === 'quotes') {
      return NextResponse.json({ ok: true, env: t.env, stale, amount, quotes: quoteSchemes(schemes, amount) }, { headers: h })
    }
    const body = {
      ok: true,
      env: t.env,
      cachedAt: new Date(cachedAt).toISOString(),
      stale,
      schemes: schemes.map((s) => ({ schemeId: s.scheme_id, name: s.name, ftosProduct: s.ftos_product, period: s.period, nir: s.nir, analysisFee: s.analysis_fee, installmentFactor: s.installment_factor, totalDueFactor: s.total_due_factor, amountMin: s.amount_min, amountMax: s.amount_max })),
      ...(hasAmount && { amount, quotes: quoteSchemes(schemes, amount) }),
    }
    return NextResponse.json(body, { headers: h })
  } catch (e) {
    log.warn('tbi.calculations_failed', { error: errText(e) })
    return NextResponse.json({ ok: false, reason: 'tbi_unavailable' }, { headers: h })
  }
}
