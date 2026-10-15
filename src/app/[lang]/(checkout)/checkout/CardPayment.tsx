'use client'

import { cashOnDelivery } from '@/config/payments'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import type { Stripe } from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import { useEffect, useState, type RefObject } from 'react'
import { useLocale } from '@/i18n/LocaleProvider'
import type { Locale } from '@/i18n/locales'

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
  address: { line1: string; city: string; state: string; postal_code: string; country: string }
}

const COPY = {
  ro: {
    loading: 'Se încarcă formularul securizat pentru card…',
    loadError: `Formularul pentru card nu s-a putut încărca. Reîncarcă pagina sau alege ${cashOnDelivery.enabled ? 'plata la livrare sau transferul bancar' : 'transferul bancar'}.`,
    checkCard: 'Verifică datele cardului.',
    declined: 'Plata nu a putut fi finalizată. Verifică datele cardului.',
    notStarted: `Plata cu cardul nu a putut fi pornită. Nu s-a efectuat nicio plată. Încearcă din nou sau alege ${cashOnDelivery.enabled ? 'plata la livrare sau transferul bancar' : 'transferul bancar'}.`,
  },
  en: {
    loading: 'Loading the secure card form…',
    loadError: `The card form did not load. Reload the page or choose ${cashOnDelivery.enabled ? 'cash on delivery or bank transfer' : 'bank transfer'}.`,
    checkCard: 'Check your card details.',
    declined: 'The payment did not go through. Check your card details.',
    notStarted: `The card payment could not start. You have not been charged. Try again or choose ${cashOnDelivery.enabled ? 'cash on delivery or bank transfer' : 'bank transfer'}.`,
  },
}

let stripePromise: Promise<Stripe | null> | null = null
let stripeKeyLoaded = ''
const stripeFor = (key: string, locale: Locale) => {
  if (!stripePromise || stripeKeyLoaded !== `${key}:${locale}`) {
    stripeKeyLoaded = `${key}:${locale}`
    stripePromise = loadStripe(key, { locale })
  }
  return stripePromise
}

/**
 * Stripe's Payment Element inside our own checkout. Card numbers are typed into Stripe's
 * secure frame and go straight to Stripe; our server only ever sees the PaymentIntent id.
 * The PaymentIntent is created after the order ("deferred intent"), for the order's total.
 */
export function CardPayment({ publishableKey, amount, currency = 'RON', apiRef }: { publishableKey: string; amount: number; currency?: string; apiRef: RefObject<CardApi | null> }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const locale = useLocale()
  const t = COPY[locale]
  return (
    <Elements
      // A new currency needs a new payment form (Stripe fixes it when the form is created).
      key={currency}
      stripe={stripeFor(publishableKey, locale)}
      options={{
        mode: 'payment',
        amount,
        currency: currency.toLowerCase(),
        // Must match the server's PaymentIntent exactly (api/checkout: a Stripe customer and
        // setup_future_usage=on_session, so the card can be offered again right after payment).
        // Without it Stripe refuses every confirmation from this form.
        setupFutureUsage: 'on_session',
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
      {state === 'loading' && <p className="py-3 text-[14.5px] text-muted">{t.loading}</p>}
      {state === 'error' ? (
        <p role="alert" className="rounded-[12px] bg-mist px-4 py-3 text-[14.5px] leading-snug text-ink">
          {t.loadError}
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
  const t = COPY[useLocale()]

  // Keep the amount shown by wallets in step with the cart.
  useEffect(() => {
    elements?.update({ amount })
  }, [elements, amount])

  useEffect(() => {
    if (!stripe || !elements) return
    apiRef.current = {
      async validate() {
        if (failed) return t.loadError
        const { error } = await elements.submit()
        return error ? (error.message ?? t.checkCard) : null
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
        if (!error) return null
        // The customer sees Stripe's own words only for problems they can fix (card declined, wrong
        // number, authentication). Anything else is ours: a calm message here, the detail in the console
        // during development only.
        if (error.type === 'card_error' || error.type === 'validation_error') return error.message ?? t.declined
        if (process.env.NODE_ENV !== 'production') console.error('[checkout] stripe.confirmPayment', error.type, error.code, error.message)
        return t.notStarted
      },
    }
    return () => {
      apiRef.current = null
    }
  }, [stripe, elements, apiRef, failed, t])

  return null
}
