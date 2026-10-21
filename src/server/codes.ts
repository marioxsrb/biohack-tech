/**
 * The checkout's one code field takes three kinds of code; this decides which one was typed and whether it may be
 * used, for the preview (/api/promo) and again inside the order's transaction (orders/service.ts):
 *   a personal voucher or gift (server/vouchers.ts)       BTV… / BTG…
 *   a referral code, the friend's first order (server/referrals.ts)   BTR…
 *   a promo code (server/promo.ts)                        anything else
 * One code per order: a voucher, a referral and a promo code never add up (the Amber 2+1 offer is automatic and is
 * not a code). The problems are named like the promo codes', so the checkout's existing messages fit.
 */
import 'server-only'
import type { Currency } from '@/lib/currency'
import { ruleIn } from '@/lib/currency'
import type { PromoCodeRule } from '@/lib/promotions'
import type { Queryable } from '@/server/db'
import { normalizeCode, promoCodes, ruleOf, type PromoProblem } from '@/server/promo'
import { checkReferral, referralRule, REFERRAL_CODE_RE } from '@/server/referrals'
import { checkVoucher, voucherRule, VOUCHER_CODE_RE, type Voucher } from '@/server/vouchers'

export type ResolvedCode =
  | { ok: true; type: 'promo'; rule: PromoCodeRule }
  | { ok: true; type: 'voucher'; rule: PromoCodeRule; voucher: Voucher }
  | { ok: true; type: 'referral'; rule: PromoCodeRule; referrer: string }
  | { ok: false; problem: PromoProblem | 'invalid' }

/**
 * `currency`: the order's currency (a voucher is in lei only). `convert`: the promo code's fixed amounts converted to it
 * (the order); the checkout's preview returns the lei rule and the page converts it, like it converts prices.
 */
export async function resolveCode(q: Queryable, raw: unknown, opts: { email?: string; phone?: string; currency?: Currency; convert?: boolean; lock?: boolean; now?: Date } = {}): Promise<ResolvedCode> {
  const code = normalizeCode(raw)
  if (!code) return { ok: false, problem: 'invalid' }
  if (VOUCHER_CODE_RE.test(code)) {
    const v = await checkVoucher(q, code, { email: opts.email, currency: opts.currency, lock: opts.lock, now: opts.now })
    if (v) return v.ok ? { ok: true, type: 'voucher', rule: voucherRule(v.voucher), voucher: v.voucher } : { ok: false, problem: v.problem }
  }
  if (REFERRAL_CODE_RE.test(code)) {
    const r = await checkReferral(q, code, { email: opts.email, phone: opts.phone })
    if (r) return r.ok ? { ok: true, type: 'referral', rule: referralRule(code), referrer: r.referrer } : { ok: false, problem: r.problem }
  }
  const checked = await promoCodes.check(q, code, { email: opts.email, lock: opts.lock, now: opts.now })
  if (!checked.ok) return checked
  return { ok: true, type: 'promo', rule: opts.currency && opts.convert ? ruleIn(ruleOf(checked.code), opts.currency) : ruleOf(checked.code) }
}
