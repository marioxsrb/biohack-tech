import { NextResponse, type NextRequest } from 'next/server'
import { PROMO_COOKIE } from '@/lib/lead'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { REFERRAL_CODE_RE } from '@/server/referrals'

export const runtime = 'nodejs'

/**
 * A referral link ({{referral_url}}): the friend lands on the store with the referrer's code in the checkout's code
 * field (the same cookie a recovery link uses). Whether the friend may use it (first order, not the referrer) is
 * decided in the checkout (server/referrals.ts). An unknown code just opens the store.
 */
export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get('cod') ?? '').toUpperCase()
  const res = NextResponse.redirect(new URL('/', req.url), 303)
  res.headers.set('Cache-Control', 'no-store')
  if (!REFERRAL_CODE_RE.test(code)) return res
  const { rows } = await (await getDb()).query('select 1 from referral_codes where code = $1', [code])
  if (rows.length) res.cookies.set(PROMO_COOKIE, code, { path: '/', sameSite: 'lax', secure: getConfig().siteUrl.startsWith('https://'), maxAge: 7 * 86_400 })
  return res
}
