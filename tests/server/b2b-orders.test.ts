/**
 * Business orders (40% from 25 Calm + Focus units): the server prices them itself; cash on delivery and bank
 * transfer wait for a person to confirm by phone before preparation (team_confirmation, outside the status flow),
 * card orders follow the normal flow. PGlite; no real payment, email or invoice.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

const { freshDb, person, TEST_ENV, lines } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { BULK_OFFER, isBulk } = await import('@/config/promotions')
const { renderEmail } = await import('@/server/integrations/email/templates')
const { renderNotification } = await import('@/server/notifications')

let db: Awaited<ReturnType<typeof freshDb>>
beforeEach(async () => {
  db = await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'file', EMAIL_FILE_DIR: '/tmp/bt-b2b-test', NOTIFY_EMAIL: 'orders@biohack-tech.ro' })
})

const CALM = 638000
const FOCUS = 322500
const place = (raw: unknown[], paymentMethod: 'cod' | 'transfer' | 'card', attemptId: string, promoCode?: string) =>
  svc.placeOrder({ lines: lines(raw), form: { ...person, paymentMethod }, attemptId, ...(promoCode && { promoCode }) } as never)

describe('business orders', () => {
  it('15 Calm + 10 Focus by cash on delivery: 40% priced by the server, waiting for the team, not preparable', async () => {
    const { order } = await place([{ productId: 'balance-wave', quantity: 15 }, { productId: 'brainlink-pro', quantity: 10 }], 'cod', 'b-1')
    const full = 15 * CALM + 10 * FOCUS
    expect(isBulk(order.promotions)).toBe(true)
    expect(order.promotions[0]).toMatchObject({ id: BULK_OFFER.id, label: 'Reducere pentru companii (40%)' })
    expect(order.discountMinor).toBe(Math.floor((full * 40 + 50) / 100))
    expect(order.totalMinor).toBe(full - order.discountMinor)
    expect(order.teamConfirmation).toBe('awaiting')
    // Preparation is refused until a person confirms.
    expect((await svc.markProcessing(order.id, 'admin')).changed).toBe(false)
    expect((await svc.markShipped(order.id, 'admin', { courier: 'FAN', trackingNumber: 'X1' })).changed).toBe(false)
    // Confirmation: once, idempotent; payment and status unchanged.
    expect((await svc.confirmByTeam(order.id, 'admin', 'admin')).changed).toBe(true)
    expect((await svc.confirmByTeam(order.id, 'admin', 'admin')).changed).toBe(false)
    const after = (await orders.byId(db, order.id))!
    expect([after.teamConfirmation, after.status, after.paymentStatus, after.teamConfirmedBy]).toEqual(['confirmed', 'confirmed', 'awaiting_collection', 'admin'])
    expect((await svc.markProcessing(order.id, 'admin')).changed).toBe(true)
  })

  it('bank transfer: waits for the team even after the money arrives; the customer is told a colleague will call', async () => {
    const { order } = await place([{ productId: 'brainlink-pro', quantity: 25 }], 'transfer', 'b-2')
    expect(order.teamConfirmation).toBe('awaiting')
    await svc.confirmPayment(order.id, 'admin')
    expect((await svc.markProcessing(order.id, 'admin')).changed).toBe(false)
    const mail = renderEmail('transfer_instructions', order, { siteUrl: 'https://biohack-tech.ro', bank: null })
    expect(mail.text).toContain('Un coleg BiohackTech vă va contacta pentru confirmarea comenzii și a detaliilor de livrare.')
    expect(mail.text).toContain('Reducere pentru companii (40%)')
    const note = renderNotification('new_transfer', order, { siteUrl: 'https://biohack-tech.ro' })
    expect(note.subject).toMatch(/^\[Companii\] Comanda/)
    expect(note.text).toContain('COMANDĂ COMPANIE')
  })

  it('card: no team confirmation, the normal flow once paid', async () => {
    const { order } = await place([{ productId: 'balance-wave', quantity: 30 }], 'card', 'b-3')
    expect(isBulk(order.promotions)).toBe(true)
    expect(order.teamConfirmation).toBeNull()
    await svc.confirmPayment(order.id, 'stripe.webhook', { amountMinor: order.totalMinor, currency: order.currency })
    expect((await svc.markProcessing(order.id, 'admin')).changed).toBe(true)
  })

  it('24 eligible units + Amber: a normal order, no team confirmation', async () => {
    const { order } = await place([{ productId: 'balance-wave', quantity: 24 }, { productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1 }], 'cod', 'b-4')
    expect(isBulk(order.promotions)).toBe(false)
    expect(order.teamConfirmation).toBeNull()
    const mail = renderEmail('cod_confirmed', order, { siteUrl: 'https://biohack-tech.ro', bank: null })
    expect(mail.text).not.toContain('Un coleg BiohackTech')
  })

  it('a promo code on a business cart is refused (never stacks with the 40%)', async () => {
    await expect(place([{ productId: 'balance-wave', quantity: 25 }], 'cod', 'b-5', 'LONGEVITY10')).rejects.toMatchObject({ problem: 'not_better' })
  })
})

describe('AI knowledge of the business offer', () => {
  it('the chatbot and the AI caller know the threshold, the mix, the exclusions, the non-stacking and the confirmation; nothing priced when locked', async () => {
    const { agentKnowledge, agentInstructions } = await import('@/server/calling/agent')
    const k = agentKnowledge('https://biohack-tech.ro')
    for (const s of ['40% reducere la toate bucățile NEUROS Calm și NEUROS Focus', '25 de bucăți', '15 Calm + 10 Focus', '24 Calm + 1 Amber', 'Nu se cumulează cu codurile', '/pentru-companii', 'un coleg Biohack Tech sună clientul', 'Nu există alte reduceri pentru firme'])
      expect(k).toContain(s)
    const locked = agentKnowledge('https://biohack-tech.ro', { prices: false })
    expect(locked).toContain('## Comenzi pentru companii')
    expect(locked).not.toMatch(/40\s?%/)
    expect(agentInstructions()).toContain('nu mai oferi codul')
  })
})
