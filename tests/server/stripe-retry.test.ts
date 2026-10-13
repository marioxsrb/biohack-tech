/**
 * Regression (Stripe TEST E2E, 13 Oct 2026): three simultaneous submits of one checkout made Stripe answer the
 * second and third with 409 "another in-progress request using this Idempotent Key"; the customer saw
 * "Plata cu cardul nu a putut fi pornită" although the order and its PaymentIntent were fine. Such a 409 is now
 * repeated briefly (the same key then returns the same object); every other error is not.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const { stripe, StripeError } = await import('@/server/integrations/stripe')
const c = { secretKey: 'sk_test_x', publishableKey: 'pk_test_x', webhookSecret: 'whsec_x', live: false, apiBase: 'https://api.stripe.test' }
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
const inProgress = () => json({ error: { type: 'idempotency_error', message: 'There is currently another in-progress request using this Idempotent Key (that probably means you submitted twice, and the other request is still going through): pi-create-1. Please try again later.' } }, 409)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Stripe idempotency: a request still in progress', () => {
  it('is repeated until the first one finishes, and returns the same PaymentIntent', async () => {
    vi.useFakeTimers()
    const calls: (string | null)[] = []
    let n = 0
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      calls.push((init.headers as Record<string, string>)['Idempotency-Key'] ?? null)
      return ++n <= 2 ? inProgress() : json({ id: 'pi_1', status: 'requires_payment_method', amount: 79000, currency: 'ron', client_secret: 'cs', metadata: { order_id: 'o1' } })
    })
    const p = stripe.createPaymentIntent(c, { id: 'o1', orderNumber: 'BHT-1', totalMinor: 79000 }, 'cus_1')
    await vi.runAllTimersAsync()
    expect((await p).id).toBe('pi_1')
    expect(calls).toEqual(['pi-create-o1', 'pi-create-o1', 'pi-create-o1'])
  })

  it('gives up after a few tries and reports the error', async () => {
    vi.useFakeTimers()
    let n = 0
    vi.stubGlobal('fetch', async () => {
      n++
      return inProgress()
    })
    const p = stripe.createCustomer(c, { id: 'o2', orderNumber: 'BHT-2', email: 'a@b.ro', name: 'A B' }).catch((e) => e)
    await vi.runAllTimersAsync()
    const e = await p
    expect(e).toBeInstanceOf(StripeError)
    expect([e.status, e.idempotencyInProgress, n]).toEqual([409, true, 5])
  })

  it('never repeats any other error (a decline, a bad request, a server error)', async () => {
    for (const res of [json({ error: { type: 'card_error', code: 'card_declined', message: 'Your card was declined.' } }, 402), json({ error: { type: 'invalid_request_error', message: 'Keys for idempotent requests can only be used with the same parameters' } }, 400), json({ error: { message: 'boom' } }, 500)]) {
      let n = 0
      vi.stubGlobal('fetch', async () => {
        n++
        return res.clone()
      })
      await expect(stripe.createPaymentIntent(c, { id: 'o3', orderNumber: 'BHT-3', totalMinor: 1 })).rejects.toBeInstanceOf(StripeError)
      expect(n).toBe(1)
    }
  })
})
