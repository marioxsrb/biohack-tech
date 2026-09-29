'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js/pure'
import { Arrow, Check, Lock } from '@/components/ui/icons'
import { getProduct } from '@/content/catalog'
import { terms } from '@/config/site'
import { formatLei } from '@/lib/money'

export type OfferView = {
  productId: string
  name: string
  reason: string
  variants: { id: string; label: string; priceMinor: number }[]
  priceMinor: number
}

type Step = 'offer' | 'confirm' | 'working' | 'done' | 'failed' | 'declined'

/**
 * The optional offer after a confirmed card payment. Two explicit steps before anything is charged:
 * "Adaugă la comandă", then "Da, plătește X lei" with the amount and the card stated. The server
 * decides the price and charges the card Stripe kept for this order; if the bank asks for
 * authentication, Stripe's own step opens here. The first order is paid either way.
 */
export function PostPurchaseOffer({ token, orderNumber, offer, publishableKey }: { token: string; orderNumber: string; offer: OfferView; publishableKey: string }) {
  const router = useRouter()
  const product = getProduct(offer.productId)!
  const [variantId, setVariantId] = useState(offer.variants[0]?.id)
  const [step, setStep] = useState<Step>('offer')
  const [message, setMessage] = useState('')
  const variant = product.variants?.find((v) => v.id === variantId)
  const price = offer.variants.find((v) => v.id === variantId)?.priceMinor ?? offer.priceMinor
  const image = variant?.images.find((i) => i.kind === 'cutout') ?? product.cutout

  const call = async (body: object) => {
    const res = await fetch('/api/upsell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...body }) })
    return (await res.json().catch(() => ({ state: 'failed' }))) as { state: string; clientSecret?: string; message?: string; orderNumber?: string }
  }

  async function accept() {
    if (step === 'working') return
    setStep('working')
    try {
      let r = await call({ action: 'accept', productId: offer.productId, variantId })
      if (r.state === 'action' && r.clientSecret) {
        // The bank wants the customer to confirm: Stripe's own authentication step, then we ask the server.
        const stripe = await loadStripe(publishableKey, { locale: 'ro' })
        const res = await stripe?.handleNextAction({ clientSecret: r.clientSecret })
        // Whatever the browser says, the server asks Stripe; a closed or failed step only lets it cancel.
        r = await call({ action: 'status', abandoned: !res || !!res.error })
      }
      for (let i = 0; r.state === 'processing' && i < 5; i++) {
        await new Promise((ok) => setTimeout(ok, 2000))
        r = await call({ action: 'status' })
      }
      if (r.state === 'paid') {
        setStep('done')
        router.refresh()
      } else {
        setMessage(r.message ?? 'Plata pentru produsul adăugat nu a reușit. Comanda ta inițială rămâne confirmată.')
        setStep('failed')
      }
    } catch {
      setMessage('Nu ne-am putut conecta. Comanda ta inițială rămâne confirmată; nu s-a mai plătit nimic.')
      setStep('failed')
    }
  }

  async function decline() {
    setStep('declined')
    await call({ action: 'decline' }).catch(() => {})
  }

  if (step === 'declined') return null

  return (
    <section aria-labelledby="offer-title" className="mt-10 overflow-hidden rounded-[24px] bg-paper shadow-[inset_0_0_0_1px_var(--color-line)]">
      <p className="border-b border-mist-2 bg-mist px-6 py-3 text-[14px] text-text max-sm:px-5">
        Ofertă opțională. Comanda <strong className="font-semibold text-ink">#{orderNumber}</strong> este deja plătită și confirmată, orice alegi aici.
      </p>
      <div className="grid gap-6 p-6 sm:grid-cols-[200px_1fr] max-sm:px-5">
        <div className="relative aspect-[4/3] rounded-[16px] bg-mist sm:aspect-square">
          <Image src={image.src} alt={image.alt} fill sizes="200px" className="object-contain p-[12%]" />
        </div>
        <div>
          <h2 id="offer-title" className="text-[clamp(22px,2.4vw,28px)] leading-tight tracking-[-0.025em]">
            Vrei să adaugi și {offer.name}?
          </h2>
          <p className="mt-2 max-w-[34em] text-[16px] leading-relaxed text-text">{offer.reason}</p>

          {step === 'done' ? (
            <p className="mt-5 flex items-center gap-2 text-[16px] font-medium text-cyan-700" role="status">
              <Check className="h-5 w-5" /> Am adăugat {offer.name}. Primești confirmarea pe email.
            </p>
          ) : step === 'failed' ? (
            <p className="mt-5 rounded-[12px] bg-mist px-4 py-3 text-[15px] text-ink" role="alert">
              {message}
            </p>
          ) : (
            <>
              {offer.variants.length > 1 && step === 'offer' && (
                <fieldset className="mt-4">
                  <legend className="text-[14.5px] text-muted">Alege varianta</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {offer.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={v.id === variantId}
                        onClick={() => setVariantId(v.id)}
                        className={`min-h-11 rounded-full px-4 text-[14.5px] font-medium transition-[background-color,box-shadow] ${
                          v.id === variantId ? 'bg-ink text-white' : 'bg-paper text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-ink)]'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              <p className="mt-4 text-[24px] font-medium tracking-[-0.02em] text-ink tabular-nums">
                {formatLei(price)} <span className="text-[14px] font-normal tracking-normal text-muted">{terms.vat}, livrare gratuită</span>
              </p>

              {step === 'offer' ? (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button type="button" className="cta" onClick={() => setStep('confirm')}>
                    Adaugă la comandă <Arrow />
                  </button>
                  <button type="button" className="btn-secondary" onClick={decline}>
                    Nu, mulțumesc
                  </button>
                </div>
              ) : (
                <div className="mt-5 rounded-[16px] bg-mist p-4">
                  <p className="text-[15px] leading-relaxed text-ink">
                    Plătești <strong>{formatLei(price)}</strong> cu același card folosit la comanda #{orderNumber}. Primești o comandă separată și o factură separată; le putem expedia împreună.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" className="cta" onClick={accept} disabled={step === 'working'} aria-busy={step === 'working'}>
                      <Lock /> {step === 'working' ? 'Se procesează…' : `Da, plătește ${formatLei(price)}`}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setStep('offer')} disabled={step === 'working'}>
                      Înapoi
                    </button>
                  </div>
                  <p className="mt-3 text-[13px] text-muted">Dacă banca cere confirmarea, se deschide pasul de verificare Stripe. Se aplică aceiași termeni și același drept de retragere.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
