/**
 * Promo codes: created in /admin/coduri, typed by the customer in the checkout, applied by the order's pricing
 * (lib/promotions.ts) after the automatic promotions, for every payment method. The server decides: the code is
 * checked here when typed (preview) and again inside the order's transaction (the row is locked, so the last
 * use of a limited code cannot be taken twice).
 *
 * A use counts while its order stands: a cancelled order or a card attempt that was never paid frees it.
 */
import 'server-only'
import { getProduct } from '@/content/catalog'
import { formatLei } from '@/lib/money'
import type { PromoCodeRule } from '@/lib/promotions'
import type { Queryable, Row } from '@/server/db'

export type PromoCode = {
  code: string
  kind: 'percent' | 'fixed'
  value: number
  products: string[] | null
  minOrderMinor: number
  startsAt: Date | null
  endsAt: Date | null
  maxUses: number | null
  oncePerEmail: boolean
  active: boolean
  note: string | null
  /** Not combined with the automatic promotions (see PromoCodeRule). */
  exclusive: boolean
  /** The lead an AI call recovery code was made for; only its address may use it. */
  leadId: string | null
  restrictedEmail: string | null
  createdAt: Date
}

export type PromoProblem = 'unknown' | 'inactive' | 'not_started' | 'expired' | 'used_up' | 'already_used' | 'other_email'

/** What the customer reads, per language. */
export const PROMO_MESSAGES: Record<'ro' | 'en', Record<PromoProblem | 'min_order' | 'no_products' | 'not_better' | 'invalid', string>> = {
  ro: {
    invalid: 'Scrie codul promoțional.',
    unknown: 'Codul nu există. Verifică literele și cifrele.',
    inactive: 'Codul nu mai este activ.',
    not_started: 'Codul nu este încă activ.',
    expired: 'Codul a expirat.',
    used_up: 'Codul a fost folosit de numărul maxim de ori.',
    already_used: 'Ai folosit deja acest cod.',
    min_order: 'Codul se aplică doar comenzilor de cel puțin {min}.',
    no_products: 'Codul nu se aplică produselor din coș{products}.',
    not_better: 'Codul nu se cumulează cu promoția din coș, iar promoția îți dă deja o reducere mai mare. Ai prețul cel mai bun.',
    other_email: 'Codul este personal: folosește adresa de email pe care ai primit codul.',
  },
  en: {
    invalid: 'Enter the promo code.',
    unknown: 'This code does not exist. Check the letters and numbers.',
    inactive: 'This code is no longer active.',
    not_started: 'This code is not active yet.',
    expired: 'This code has expired.',
    used_up: 'This code has reached its usage limit.',
    already_used: 'You have already used this code.',
    min_order: 'This code applies to orders of at least {min}.',
    no_products: 'This code does not apply to the products in your cart{products}.',
    not_better: 'This code cannot be combined with the promotion in your cart, which already saves you more. You have the best price.',
    other_email: 'This code is personal: use the email address it was sent to.',
  },
}

export function promoMessage(problem: keyof (typeof PROMO_MESSAGES)['ro'], locale: 'ro' | 'en', rule?: Pick<PromoCodeRule, 'minOrderMinor' | 'products'>) {
  const names = rule?.products?.map((p) => getProduct(p)?.name ?? p).join(', ')
  return PROMO_MESSAGES[locale][problem]
    .replace('{min}', rule ? formatLei(rule.minOrderMinor) : '')
    .replace('{products}', names ? (locale === 'en' ? ` (only ${names})` : ` (doar ${names})`) : '')
}

/** Codes are case-insensitive for the customer: stored and compared in upper case, letters, digits, - and _. */
export const normalizeCode = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toUpperCase().replace(/\s+/g, '') : '')
export const CODE_RE = /^[A-Z0-9_-]{3,32}$/

const d = (v: unknown) => (v ? new Date(v as string) : null)
const toCode = (r: Row): PromoCode => ({
  code: r.code as string,
  kind: r.kind as PromoCode['kind'],
  value: Number(r.value),
  products: (r.products as string[] | null) ?? null,
  minOrderMinor: Number(r.min_order_minor ?? 0),
  startsAt: d(r.starts_at),
  endsAt: d(r.ends_at),
  maxUses: r.max_uses == null ? null : Number(r.max_uses),
  oncePerEmail: !!r.once_per_email,
  active: !!r.active,
  note: (r.note as string) ?? null,
  exclusive: !!r.exclusive,
  leadId: (r.lead_id as string) ?? null,
  restrictedEmail: (r.restricted_email as string) ?? null,
  createdAt: new Date(r.created_at as string),
})

export const ruleOf = (c: PromoCode): PromoCodeRule => ({ code: c.code, kind: c.kind, value: c.value, products: c.products, minOrderMinor: c.minOrderMinor, ...(c.exclusive && { exclusive: true }) })

/** Uses that count: the order still stands (not cancelled, not an unpaid or failed card attempt). */
const STANDING = `o.status not in ('cancelled','abandoned') and o.payment_status not in ('failed','cancelled')`

export const promoCodes = {
  async get(q: Queryable, code: string, lock = false): Promise<PromoCode | null> {
    const { rows } = await q.query(`select * from promo_codes where code = $1 ${lock ? 'for update' : ''}`, [code])
    return rows[0] ? toCode(rows[0]) : null
  },

  async uses(q: Queryable, code: string, email?: string): Promise<{ total: number; byEmail: number }> {
    const { rows } = await q.query<{ total: number; by_email: number }>(
      `select count(*)::int as total, count(*) filter (where r.email = $2)::int as by_email
       from promo_redemptions r join orders o on o.id = r.order_id where r.code = $1 and ${STANDING}`,
      [code, (email ?? '').trim().toLowerCase()],
    )
    return { total: rows[0]?.total ?? 0, byEmail: rows[0]?.by_email ?? 0 }
  },

  /**
   * Whether a code may be used now (by this email, when known). Products and the minimum order are checked by the
   * pricing itself, on the actual cart. `lock`: inside the order's transaction.
   */
  async check(q: Queryable, raw: unknown, opts: { email?: string; lock?: boolean; now?: Date } = {}): Promise<{ ok: true; code: PromoCode } | { ok: false; problem: PromoProblem | 'invalid' }> {
    const code = normalizeCode(raw)
    if (!code) return { ok: false, problem: 'invalid' }
    if (!CODE_RE.test(code)) return { ok: false, problem: 'unknown' }
    const c = await promoCodes.get(q, code, opts.lock)
    if (!c) return { ok: false, problem: 'unknown' }
    const now = opts.now ?? new Date()
    if (!c.active) return { ok: false, problem: 'inactive' }
    if (c.startsAt && now < c.startsAt) return { ok: false, problem: 'not_started' }
    if (c.endsAt && now >= c.endsAt) return { ok: false, problem: 'expired' }
    if (c.restrictedEmail) {
      // A personal code: only its own address (checked again in the order, where the address is known), and
      // never after that address bought anything since the code was made.
      const email = (opts.email ?? '').trim().toLowerCase()
      if (email && email !== c.restrictedEmail) return { ok: false, problem: 'other_email' }
      const bought = await q.query(`select 1 from orders o where o.email = $1 and o.created_at > $2 and ${STANDING} and not exists (select 1 from promo_redemptions r where r.order_id = o.id and r.code = $3) limit 1`, [
        c.restrictedEmail,
        c.createdAt,
        c.code,
      ])
      if (bought.rows.length) return { ok: false, problem: 'inactive' }
    }
    if (c.maxUses != null || (c.oncePerEmail && opts.email)) {
      const u = await promoCodes.uses(q, c.code, opts.email)
      if (c.maxUses != null && u.total >= c.maxUses) return { ok: false, problem: 'used_up' }
      if (c.oncePerEmail && opts.email && u.byEmail > 0) return { ok: false, problem: 'already_used' }
    }
    return { ok: true, code: c }
  },

  redeem: (q: Queryable, r: { orderId: string; code: string; email: string; discountMinor: number }) =>
    q.query('insert into promo_redemptions (order_id, code, email, discount_minor) values ($1, $2, $3, $4) on conflict (order_id) do nothing', [r.orderId, r.code, r.email.trim().toLowerCase(), r.discountMinor]),

  /** For /admin/coduri: every code with its standing uses and the discount they gave. */
  async list(q: Queryable) {
    const { rows } = await q.query(
      `select c.*, coalesce(u.uses, 0)::int as uses, coalesce(u.discount, 0)::int as discount, coalesce(u.revenue, 0)::int as revenue
       from promo_codes c left join (
         select r.code, count(*) as uses, sum(r.discount_minor) as discount, sum(o.total_minor) as revenue
         from promo_redemptions r join orders o on o.id = r.order_id where ${STANDING} group by r.code
       ) u on u.code = c.code where c.lead_id is null and c.restricted_email is null order by c.active desc, c.created_at desc`,
    )
    return rows.map((r) => ({ ...toCode(r), uses: Number(r.uses), discountMinor: Number(r.discount), revenueMinor: Number(r.revenue) }))
  },

  async create(q: Queryable, c: Omit<PromoCode, 'createdAt' | 'active' | 'exclusive' | 'leadId' | 'restrictedEmail'>) {
    const { rows } = await q.query(
      `insert into promo_codes (code, kind, value, products, min_order_minor, starts_at, ends_at, max_uses, once_per_email, note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (code) do nothing returning code`,
      [c.code, c.kind, c.value, c.products, c.minOrderMinor, c.startsAt, c.endsAt, c.maxUses, c.oncePerEmail, c.note],
    )
    return rows.length > 0
  },

  setActive: (q: Queryable, code: string, active: boolean) => q.query('update promo_codes set active = $2, updated_at = now() where code = $1', [code, active]),
}
