import { describe, expect, it } from 'vitest'
import { signPayload, verifyWebhook } from '@/server/integrations/stripe'

const secret = 'whsec_test'
const body = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded', livemode: false, data: { object: { id: 'pi_1' } } })

describe('Stripe webhook signature', () => {
  it('accepts a correctly signed, fresh event', () => {
    expect(verifyWebhook(body, signPayload(body, secret), secret).id).toBe('evt_1')
  })
  it('rejects a tampered body, a wrong secret, a missing or malformed header', () => {
    const header = signPayload(body, secret)
    expect(() => verifyWebhook(body.replace('pi_1', 'pi_2'), header, secret)).toThrow('signature mismatch')
    expect(() => verifyWebhook(body, header, 'whsec_other')).toThrow('signature mismatch')
    expect(() => verifyWebhook(body, null, secret)).toThrow('missing')
    expect(() => verifyWebhook(body, 'nonsense', secret)).toThrow('malformed')
  })
  it('rejects replays of old requests', () => {
    const old = Math.floor(Date.now() / 1000) - 3600
    expect(() => verifyWebhook(body, signPayload(body, secret, old), secret)).toThrow('tolerance')
  })
  it('accepts any of several v1 signatures (secret rotation)', () => {
    const t = Math.floor(Date.now() / 1000)
    const good = signPayload(body, secret, t).split(',')[1]
    expect(verifyWebhook(body, `t=${t},v1=deadbeef,${good}`, secret).id).toBe('evt_1')
  })
})
