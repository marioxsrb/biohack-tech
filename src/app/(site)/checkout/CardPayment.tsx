'use client'

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import type { Stripe } from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import { useEffect, useState, type RefObject } from 'react'

/** What the checkout form needs from Stripe, without depending on Stripe's React context. */
export type CardApi = {
  /** Validates the card fields. Returns a message to show, or null when complete. */
  validate: () => Promise<string | null>
  /** Confirms the PaymentIntent; on success the browser leaves for the order page. Returns an error message otherwise. */
  confirm: (clientSecret: string, returnUrl: string, billing: BillingDetails) => Promise<string | null>
}

export type BillingDetails = {
  name: string
  email: string
  phone: string
  address: { line1: string; city: string; state: string; postal_code: string; country: 'RO' }
}

let stripePromise: Promise<Stripe | null> | null = null
let stripeKeyLoaded = ''
const stripeFor = (key: string) => {
  if (!stripePromise || stripeKeyLoaded !== key) {
    stripeKeyLoaded = key
    stripePromise = loadStripe(key, { locale: 'ro' })
  }
  return stripePromise
}

/**
 * Stripe's Payment Element inside our own checkout. Card numbers are typed into Stripe's
 * secure frame and go straight to Stripe; our server only ever sees the PaymentIntent id.
 * The PaymentIntent is created after the order ("deferred intent"), for the order's total.
 */
export function CardPayment({ publishableKey, amount, apiRef }: { publishableKey: string; amount: number; apiRef: RefObject<CardApi | null> }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  return (
    <Elements
      stripe={stripeFor(publishableKey)}
      options={{
        mode: 'payment',
        amount,
        currency: 'ron',
        // Only what the server's PaymentIntent accepts (card, incl. Apple Pay / Google Pay). Without this,
        // Stripe shows every method enabled in the dashboard (Klarna, Revolut Pay...), which would then fail.
        paymentMethodTypes: ['card'],
        fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap' }],
        appearance: {
          theme: 'stripe',
          variables: {
            fontFamily: 'Geist, system-ui, sans-serif',
            fontSizeBase: '16px',
            colorPrimary: '#0b1316',
            colorText: '#0b1316',
            colorTextSecondary: '#5a6870',
            colorDanger: '#b83232',
            colorBackground: '#ffffff',
            borderRadius: '10px',
            spacingUnit: '4px',
          },
          rules: {
            '.Input': { boxShadow: 'inset 0 0 0 1px #dce3e6', border: 'none', padding: '14px' },
            '.Input:focus': { boxShadow: 'inset 0 0 0 2px #06b6d4' },
            '.Label': { fontWeight: '500', color: '#0b1316' },
          },
        },
      }}
    >
      <Bridge amount={amount} apiRef={apiRef} failed={state === 'error'} />
      {state === 'loading' && <p className="py-3 text-[14.5px] text-muted">Se încarcă formularul securizat pentru card…</p>}
      {state === 'error' ? (
        <p role="alert" className="rounded-[12px] bg-mist px-4 py-3 text-[14.5px] leading-snug text-ink">
          Formularul pentru card nu s-a putut încărca. Reîncarcă pagina sau alege transferul bancar.
        </p>
      ) : (
        <PaymentElement
          onReady={() => setState('ready')}
          onLoadError={() => setState('error')}
          options={{ layout: 'tabs', fields: { billingDetails: { address: 'never' } }, wallets: { applePay: 'auto', googlePay: 'auto' } }}
        />
      )}
    </Elements>
  )
}

function Bridge({ amount, apiRef, failed }: { amount: number; apiRef: RefObject<CardApi | null>; failed: boolean }) {
  const stripe = useStripe()
  const elements = useElements()

  // Keep the amount shown by wallets in step with the cart.
  useEffect(() => {
    elements?.update({ amount })
  }, [elements, amount])

  useEffect(() => {
    if (!stripe || !elements) return
    apiRef.current = {
      async validate() {
        if (failed) return 'Formularul pentru card nu s-a putut încărca. Reîncarcă pagina sau alege transferul bancar.'
        const { error } = await elements.submit()
        return error ? (error.message ?? 'Verifică datele cardului.') : null
      },
      async confirm(clientSecret, returnUrl, billing) {
        const { error } = await stripe.confirmPayment({
          elements,
          clientSecret,
          confirmParams: {
            return_url: returnUrl,
            // The billing address comes from our form (Stripe's own address field is hidden).
            payment_method_data: { billing_details: { ...billing, address: { ...billing.address, line2: '' } } },
          },
        })
        return error ? (error.message ?? 'Plata nu a putut fi finalizată. Încearcă din nou sau alege transferul bancar.') : null
      },
    }
    return () => {
      apiRef.current = null
    }
  }, [stripe, elements, apiRef, failed])

  return null
}
