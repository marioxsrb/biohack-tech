/**
 * The workflow planner (pure) and the email variables: the 14 workflows / 59 emails with their approved timings,
 * stop on purchase, consent, pauses, campaign-only steps, calendar days never sent late, vouchers, the weekly limit;
 * {{cart_items}} grouping, singular/plural, the book without "NEUROS", complementary products not owned.
 */
import { describe, expect, it } from 'vitest'
import { ALL_TEMPLATES, WORKFLOWS } from '@/config/workflows'
import { decide, dueAt, type Facts } from '@/server/workflows/planner'
import { cartEligibleVouchers, cartItems, cartProductBenefits, cartVariant, joinRo, postPurchaseFacts, voucherAmount, voucherExpiry } from '@/server/workflows/variables'

const H = 3_600_000
const start = new Date('2026-11-02T10:00:00Z')
const facts = (over: Partial<Facts> = {}): Facts => ({ now: start, consent: true, purchasedSince: [], activeOther: [], promoSent: [], ...over })

describe('the 14 workflows, 59 emails, approved timings', () => {
  it('the emails per workflow, as approved in Email Studio', () => {
    expect(Object.fromEntries(Object.values(WORKFLOWS).map((w) => [w.id, w.steps.length]))).toEqual({
      'abandoned-cart': 4, 'post-purchase': 4, 'landing-calm': 5, 'landing-focus': 5, 'landing-amber': 3, referral: 1, vip: 1,
      welcome: 9, educatie: 8, 'win-back': 2, nudge: 2, 'black-friday': 5, craciun: 4, 'anul-nou': 6,
    })
  })
  it('14 workflows and 59 distinct templates', () => {
    expect(Object.keys(WORKFLOWS)).toHaveLength(14)
    expect(ALL_TEMPLATES).toHaveLength(59)
    expect(new Set(ALL_TEMPLATES).size).toBe(59)
  })
  it.each([
    ['abandoned-cart', [1, 20, 72, 144]],
    ['welcome', [0, 3, 7, 12, 17, 22, 28, 35, 42].map((d) => d * 24)],
    ['educatie', [0, 5, 10, 15, 20, 25, 32, 40].map((d) => d * 24)],
    ['landing-calm', [0, 3, 7, 14, 21].map((d) => d * 24)],
    ['landing-amber', [0, 3, 7].map((d) => d * 24)],
    ['post-purchase', [0, 3, 7, 14].map((d) => d * 24)],
  ] as const)('%s', (id, hours) => {
    const e = { workflow: id, step: 0, startedAt: start }
    expect(WORKFLOWS[id].steps.map((_, i) => (dueAt(e, i).getTime() - start.getTime()) / H)).toEqual(hours)
  })
  it('seasonal by day: Christmas in December, New Year from 27 December into January of the next year', () => {
    const x = { workflow: 'craciun' as const, step: 0, startedAt: new Date('2026-12-01T00:00:00Z') }
    expect(WORKFLOWS.craciun.steps.map((_, i) => dueAt(x, i).toISOString().slice(0, 10))).toEqual(['2026-12-01', '2026-12-08', '2026-12-15', '2026-12-24'])
    const n = { workflow: 'anul-nou' as const, step: 0, startedAt: new Date('2026-12-27T00:00:00Z') }
    expect(WORKFLOWS['anul-nou'].steps.map((_, i) => dueAt(n, i).toISOString().slice(0, 10))).toEqual(['2026-12-27', '2026-12-29', '2027-01-02', '2027-01-07', '2027-01-15', '2027-01-31'])
  })
  it('Black Friday relative to its day; Win-back 02 at 7–14 days per segment', () => {
    const bf = { workflow: 'black-friday' as const, step: 0, startedAt: new Date('2026-11-27T07:00:00Z') }
    expect(WORKFLOWS['black-friday'].steps.map((_, i) => dueAt(bf, i).toISOString().slice(0, 10))).toEqual(['2026-11-13', '2026-11-24', '2026-11-27', '2026-11-29', '2026-12-04'])
    expect((dueAt({ workflow: 'win-back', step: 1, startedAt: start, data: { secondAfterDays: 30 } }, 1).getTime() - start.getTime()) / H).toBe(14 * 24)
  })
})

describe('decisions', () => {
  const at = (h: number) => new Date(start.getTime() + h * H)
  it('sends when due, waits before', () => {
    expect(decide({ workflow: 'abandoned-cart', step: 0, startedAt: start }, facts({ now: at(0.5) }))).toMatchObject({ action: 'wait', reason: 'not_due' })
    expect(decide({ workflow: 'abandoned-cart', step: 0, startedAt: start }, facts({ now: at(1) }))).toMatchObject({ action: 'send', template: 'abandoned-cart-01' })
  })
  it('a purchase stops Abandoned Cart and Win-back; a landing sequence only for its own product', () => {
    expect(decide({ workflow: 'abandoned-cart', step: 1, startedAt: start }, facts({ now: at(30), purchasedSince: ['carte-diana'] }))).toEqual({ action: 'stop', reason: 'purchased' })
    expect(decide({ workflow: 'landing-calm', step: 1, startedAt: start }, facts({ now: at(80), purchasedSince: ['brainlink-pro'] })).action).toBe('send')
    expect(decide({ workflow: 'landing-calm', step: 1, startedAt: start }, facts({ now: at(80), purchasedSince: ['balance-wave'] }))).toEqual({ action: 'stop', reason: 'purchased_product' })
  })
  it('no marketing consent (unsubscribed): promotional emails stop; the post-purchase guides still go', () => {
    expect(decide({ workflow: 'welcome', step: 0, startedAt: start }, facts({ consent: false }))).toEqual({ action: 'stop', reason: 'no_consent' })
    expect(decide({ workflow: 'post-purchase', step: 0, startedAt: start }, facts({ consent: false })).action).toBe('send')
    expect(decide({ workflow: 'post-purchase', step: 3, startedAt: start }, facts({ now: at(14 * 24), consent: false })).action).toBe('stop')
  })
  it('Abandoned Cart pauses the landing, Welcome and Educație sequences; they resume after', () => {
    const d = decide({ workflow: 'landing-focus', step: 1, startedAt: start }, facts({ now: at(80), activeOther: ['abandoned-cart'] }))
    expect(d).toMatchObject({ action: 'wait', reason: 'paused_by_abandoned-cart' })
    expect(decide({ workflow: 'welcome', step: 0, startedAt: start }, facts({ activeOther: ['educatie'] })).action).toBe('send')
  })
  it('a landing first email states the voucher: sent with it, skipped when the contact cannot have it', () => {
    expect(decide({ workflow: 'landing-calm', step: 0, startedAt: start }, facts())).toMatchObject({ action: 'wait', reason: 'voucher_pending' })
    expect(decide({ workflow: 'landing-calm', step: 0, startedAt: start }, facts({ voucher: 'ready' })).action).toBe('send')
    expect(decide({ workflow: 'landing-calm', step: 0, startedAt: start }, facts({ voucher: 'refused' }))).toMatchObject({ action: 'skip', reason: 'no_voucher' })
  })
  it('Black Friday 04 and 05 only when the campaign says so', () => {
    const bf = { workflow: 'black-friday' as const, step: 3, startedAt: start }
    expect(decide(bf, facts({ now: at(48) }))).toMatchObject({ action: 'skip', reason: 'condition_bf_offers_continue' })
    expect(decide(bf, facts({ now: at(48), campaign: { bf_offers_continue: true } })).action).toBe('send')
  })
  it('a calendar email is never sent late', () => {
    const x = { workflow: 'craciun' as const, step: 3, startedAt: new Date('2026-12-01T00:00:00Z') }
    expect(decide(x, facts({ now: new Date('2026-12-26T09:00:00Z') }))).toMatchObject({ action: 'skip', reason: 'day_passed' })
  })
  it('weekly limit: the 4th promotional email of 7 days waits until a slot frees; Abandoned Cart is exempt', () => {
    const now = at(24 * 7)
    const sent = [at(24 * 1), at(24 * 3), at(24 * 5)]
    const d = decide({ workflow: 'welcome', step: 1, startedAt: start }, facts({ now, promoSent: sent }))
    expect(d).toEqual({ action: 'wait', until: new Date(sent[0].getTime() + 7 * 24 * H), reason: 'weekly_limit' })
    expect(decide({ workflow: 'welcome', step: 1, startedAt: start }, facts({ now, promoSent: sent, limit: 2 })).action).toBe('wait')
    expect(decide({ workflow: 'abandoned-cart', step: 0, startedAt: start }, facts({ now: at(1), promoSent: sent.map(() => at(0.5)) })).action).toBe('send')
  })
  it('finished sequences complete', () => {
    expect(decide({ workflow: 'vip', step: 1, startedAt: start }, facts())).toEqual({ action: 'complete' })
  })
})

describe('variables', () => {
  it('{{cart_items}}: identical products on one row, different frames apart', () => {
    expect(
      cartItems([
        { productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 },
        { productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 },
        { productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 1 },
        { productId: 'balance-wave', quantity: 2 },
      ]),
    ).toEqual(['2 × NEUROS Amber (Cat eye · Negru)', '1 × NEUROS Amber (Unisex pătrat · Maro)', '2 × NEUROS Calm'])
  })
  it('{{cart_product_benefits}} once per product type; the voucher variant per cart', () => {
    const lines = [{ productId: 'balance-wave', quantity: 1 }, { productId: 'balance-wave', quantity: 1 }, { productId: 'carte-diana', quantity: 1 }]
    expect(cartProductBenefits(lines)).toEqual(['NEUROS Calm: Pentru calm', 'Cartea „Știu. Vreau. DE CE NU POT?”: Răspunsul este în creier'])
    expect(cartVariant([{ productId: 'balance-wave', quantity: 3 }])).toBe('single')
    expect(cartVariant(lines)).toBe('multiple')
    expect(cartVariant([{ productId: 'carte-diana', quantity: 1 }])).toBe('no_voucher')
  })
  it('{{voucher_amount}}, {{voucher_expiry}}, {{cart_eligible_vouchers}}', () => {
    expect([voucherAmount(64000), voucherAmount(32500), voucherAmount(3000)]).toEqual(['640', '325', '30'])
    const exp = new Date('2026-10-28T21:59:00Z')
    expect(voucherExpiry(exp)).toBe('28 octombrie 2026')
    expect(cartEligibleVouchers([{ productId: 'balance-wave', amountMinor: 64000, expiresAt: exp }, { productId: 'ochelari-biohack', amountMinor: 3000, expiresAt: exp }])).toEqual([
      'NEUROS Calm: 640 lei, până la 28 octombrie 2026',
      'NEUROS Amber: 30 lei, până la 28 octombrie 2026',
    ])
  })
  it('post-purchase: singular/plural, the book without NEUROS, only products not owned, the whole range', () => {
    expect(joinRo(['A', 'B', 'C'])).toBe('A, B și C')
    const one = postPurchaseFacts(['balance-wave'], [])
    expect([one.productName, one.productModels, one.plural, one.subjectNeedsRule]).toEqual(['NEUROS Calm', 'Calm', false, false])
    expect(one.complementary).toEqual(['brainlink-pro', 'ochelari-biohack', 'carte-diana'])
    const two = postPurchaseFacts(['balance-wave', 'ochelari-biohack', 'balance-wave'], ['brainlink-pro'])
    expect([two.productName, two.plural]).toEqual(['NEUROS Calm și NEUROS Amber', true])
    expect(two.complementary).toEqual(['carte-diana'])
    const book = postPurchaseFacts(['carte-diana'], [])
    expect(book.productName).not.toMatch(/NEUROS/)
    expect(book.subjectNeedsRule).toBe(true)
    expect(postPurchaseFacts(['carte-diana'], ['balance-wave', 'brainlink-pro', 'ochelari-biohack']).ownsAll).toBe(true)
  })
})

describe('the GHL sub-account update (built, never sent here)', async () => {
  const { contactUpdate, missingValues, sendTag, ghlWorkflowsConfig } = await import('@/server/workflows/ghl-map')
  it('one tag per email to send, the interest segments, the variables as fields', () => {
    const u = contactUpdate({ workflow: 'abandoned-cart', template: 'abandoned-cart-04', email: ' Ana@Exemplu.ro ', interests: ['balance-wave', 'balance-wave'], values: { voucherAmount: '640', checkoutUrl: 'https://biohack-tech.ro/reluare/x' } })
    expect(u).toEqual({
      email: 'ana@exemplu.ro',
      tags: ['bt-wf-abandoned-cart-04', 'bt-interes-calm'],
      customFields: [
        { key: 'contact.bt_voucher_amount', field_value: '640' },
        { key: 'contact.bt_checkout_url', field_value: 'https://biohack-tech.ro/reluare/x' },
      ],
    })
    expect(sendTag('welcome-01')).toBe('bt-wf-welcome-01')
  })
  it('an email whose variables have no value is never sendable', () => {
    expect(missingValues(['product_name', 'voucher_amount', 'voucher_expiry'], { productName: 'NEUROS Calm', voucherAmount: '640' })).toEqual(['voucher_expiry'])
    expect(missingValues(['bf_discount_calm'])).toEqual(['bf_discount_calm'])
  })
  it('no sub-account credentials: no configuration', () => {
    expect(ghlWorkflowsConfig({})).toBeNull()
  })
})

describe('the GHL sub-account setup list', async () => {
  const { ghlWorkflowSpec } = await import('@/server/workflows/ghl-setup')
  const { readFileSync, writeFileSync, existsSync } = await import('node:fs')
  it('scripts/ghl-wf-spec.json is the same list (59 email tags, interests, events, the fields)', () => {
    const spec = ghlWorkflowSpec()
    const file = 'scripts/ghl-wf-spec.json'
    if (!existsSync(file) || process.env.WRITE_GHL_SPEC) writeFileSync(file, JSON.stringify(spec, null, 2) + '\n')
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(spec)
    expect(spec.tags.filter((t) => t.startsWith('bt-wf-') && /-\d\d$/.test(t))).toHaveLength(59)
    expect(new Set(spec.tags).size).toBe(spec.tags.length)
  })
})
