/**
 * Data readiness for CRM and email segmentation: everything is read from the canonical order.
 */
import { describe, expect, it } from 'vitest'
import { customerProfile, isConfirmedPurchase, orderSegments, purchaseState, type SegmentInput } from '@/lib/segments'
import { tagsFor } from '@/server/integrations/ghl'
import type { Order } from '@/server/orders/model'

const order = (o: Partial<SegmentInput> = {}): SegmentInput => ({
  status: 'confirmed',
  paymentStatus: 'paid',
  kind: 'checkout',
  items: [],
  promotions: [],
  attribution: null,
  marketingConsent: false,
  ...o,
})
const item = (productId: string, quantity = 1, variantId: string | null = null, promotionId: string | null = null) => ({ productId, variantId, quantity, promotionId })

describe('order segments', () => {
  it('products and configurations by canonical id (NEUROS Flow stays brain-flow)', () => {
    const s = orderSegments(order({ items: [item('brain-flow', 1, '13-zone'), item('ochelari-biohack', 2, 'cat-eye-bej'), item('balance-wave')] }))
    expect(s.products).toEqual(['brain-flow', 'ochelari-biohack', 'balance-wave'])
    expect(s.variants).toEqual(['brain-flow:13-zone', 'ochelari-biohack:cat-eye-bej'])
  })

  it('promotions: eligible, qualified and applied are distinct, by stable id', () => {
    const none = orderSegments(order({ items: [item('balance-wave'), item('ochelari-biohack', 1, 'cat-eye-bej')] }))
    expect(none.promotions['trei-produse-20']).toEqual({ eligible: true, units: 1, qualified: false, applied: false, amountMinor: 0 })
    expect(none.promotions['amber-2-plus-1']).toMatchObject({ eligible: true, qualified: false, applied: false })

    const both = orderSegments(
      order({
        items: [item('balance-wave', 1, null, 'trei-produse-20'), item('brainlink-pro', 1, null, 'trei-produse-20'), item('brain-flow', 1, '4-zone', 'trei-produse-20'), item('ochelari-biohack', 3, 'patrat-maro', 'amber-2-plus-1')],
        promotions: [{ id: 'trei-produse-20', amountMinor: 464000 }, { id: 'amber-2-plus-1', amountMinor: 31500 }],
      }),
    )
    expect(both.promotions['trei-produse-20']).toEqual({ eligible: true, units: 3, qualified: true, applied: true, amountMinor: 464000 })
    expect(both.promotions['amber-2-plus-1']).toEqual({ eligible: true, units: 3, qualified: true, applied: true, amountMinor: 31500 })

    const focusOnly = orderSegments(order({ items: [item('brainlink-pro')] }))
    expect(focusOnly.promotions['amber-2-plus-1']).toMatchObject({ eligible: false, applied: false })
  })

  it('source: landing, UTM, entry surface; original vs post-purchase order', () => {
    const l = orderSegments(order({ attribution: { landing: 'amber', landingHost: 'amber.biohack-tech.ro', landingPath: '/', utm: { utm_source: 'meta', utm_campaign: 'toamna' }, entry: 'landing' } }))
    expect([l.channel, l.landing, l.entry, l.utm]).toEqual(['landing', 'amber', 'landing', { utm_source: 'meta', utm_campaign: 'toamna' }])
    const site = orderSegments(order({ attribution: { entry: 'product' } }))
    expect([site.channel, site.landing, site.entry]).toEqual(['site', null, 'product'])
    expect(orderSegments(order({ kind: 'upsell' })).origin).toBe('upsell')
    expect(orderSegments(order()).origin).toBe('original')
  })

  it('purchase versus intent', () => {
    expect(
      [
        { status: 'pending', paymentStatus: 'pending' },
        { status: 'pending', paymentStatus: 'awaiting_transfer' },
        { status: 'abandoned', paymentStatus: 'pending' },
        { status: 'pending', paymentStatus: 'failed' },
        { status: 'confirmed', paymentStatus: 'paid' },
        { status: 'shipped', paymentStatus: 'partially_refunded' },
        { status: 'cancelled', paymentStatus: 'refunded' },
        { status: 'cancelled', paymentStatus: 'awaiting_transfer' },
      ].map(purchaseState),
    ).toEqual(['open', 'open', 'abandoned', 'abandoned', 'confirmed', 'confirmed', 'refunded', 'cancelled'])
  })

  it('marketing consent is its own field; buying never implies it', () => {
    expect(orderSegments(order({ marketingConsent: false })).marketingConsent).toBe(false)
    expect(customerProfile([order({ items: [item('balance-wave')] })])).not.toHaveProperty('marketingConsent')
  })
})

describe('customer profile (cross-sell readiness)', () => {
  it('bought Calm, never Amber; Amber left in an abandoned order; configurations and promotions used', () => {
    const p = customerProfile([
      order({ items: [item('balance-wave')], attribution: { landing: 'calm' } }),
      order({ status: 'abandoned', paymentStatus: 'pending', items: [item('ochelari-biohack', 1, 'cat-eye-negru')] }),
      order({ kind: 'upsell', items: [item('brain-flow', 1, '1-zona')] }),
      order({ status: 'pending', paymentStatus: 'failed', items: [item('brainlink-pro')] }),
    ])
    expect(p.bought.sort()).toEqual(['balance-wave', 'brain-flow'])
    expect(p.bought).not.toContain('ochelari-biohack')
    expect(p.abandoned.sort()).toEqual(['brainlink-pro', 'ochelari-biohack'])
    expect(p.boughtVariants).toEqual(['brain-flow:1-zona'])
    expect(p.upsellOrders).toBe(1)
    expect(p.landings).toEqual(['calm'])
  })
})

describe('GHL product tags follow the same confirmed-purchase rule', () => {
  const base = { items: [{ productId: 'brain-flow' }, { productId: 'ochelari-biohack' }], customer: { buyerType: 'pf' }, returnStatus: null } as unknown as Order
  it('no bt-cumparat-* while pending, awaiting transfer, failed or abandoned', () => {
    for (const [status, paymentStatus] of [['pending', 'pending'], ['pending', 'awaiting_transfer'], ['pending', 'failed'], ['abandoned', 'pending'], ['cancelled', 'cancelled']]) {
      expect(tagsFor({ ...base, status, paymentStatus } as Order)).toEqual([])
      expect(isConfirmedPurchase({ status, paymentStatus })).toBe(false)
    }
  })
  it('once paid: client + one stable tag per product (bt-cumparat-brain-flow for NEUROS Flow)', () => {
    expect(tagsFor({ ...base, status: 'confirmed', paymentStatus: 'paid' } as Order)).toEqual(['bt-client', 'bt-cumparat-brain-flow', 'bt-cumparat-amber'])
  })
})
