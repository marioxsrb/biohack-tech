/**
 * Regression, 29 Sep 2026: every real card payment from the checkout failed with Stripe's
 * "setup_future_usage (on_session) does not match (null)". The server's PaymentIntent keeps the card for
 * the post-payment offer (setup_future_usage=on_session); the browser's deferred-intent Payment Element
 * must declare the same. Server-side confirmations (scripts, audits) never exercised this path.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { site } from '@/config/site'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

describe('card payment: browser and server agree with Stripe', () => {
  it('Payment Element declares setupFutureUsage on_session, like the PaymentIntent', () => {
    expect(read('src/server/integrations/stripe.ts')).toMatch(/setup_future_usage: 'on_session'/)
    expect(read('src/app/[lang]/(checkout)/checkout/CardPayment.tsx')).toMatch(/setupFutureUsage: 'on_session'/)
  })

  it('internal Stripe errors never reach the customer verbatim; card problems do (localized by Stripe)', () => {
    const src = read('src/app/[lang]/(checkout)/checkout/CardPayment.tsx')
    expect(src).toMatch(/error\.type === 'card_error' \|\| error\.type === 'validation_error'/)
    expect(src).toContain('Plata cu cardul nu a putut fi pornită. Nu s-a efectuat nicio plată.')
  })
})

describe('checkout errors: calm, with the Biohack Tech contact and a reference, no internals', () => {
  it('uses the central contact (contact@biohack-tech.ro) and a short reference that is also logged', () => {
    expect(site.email).toBe('contact@biohack-tech.ro')
    const route = read('src/app/api/checkout/route.ts')
    expect(route).toContain("log.error('checkout.order_failed', { ref, stage: 'order', error: errText(e) })")
    expect(route).toMatch(/Comanda nu a putut fi înregistrată\. Nu s-a efectuat nicio plată\..*\$\{site\.email\} \(cod \$\{ref\}\)/)
    expect(route).not.toMatch(/fail\([^)]*errText/)
  })

  it('no legacy NEUROS support address anywhere in the app', () => {
    for (const f of ['src/config/site.ts', 'src/app/api/checkout/route.ts', 'src/server/integrations/email/templates.ts']) expect(read(f)).not.toContain('contact@neuros.ro')
  })
})
