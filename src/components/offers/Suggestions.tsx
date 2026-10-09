'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { Price } from '@/components/cart/Price'
import { Thumb } from '@/components/cart/Thumb'
import { Check, Plus } from '@/components/ui/icons'
import { getProduct } from '@/content/catalog'
import { useLocale } from '@/i18n/LocaleProvider'
import { trackUi } from '@/lib/analytics'
import { reasonText, recommend, type Recommendation } from '@/lib/recommend'
import { useOfferSheets } from './OfferSheets'

const COPY = {
  ro: {
    pairs: (n?: number) => (n === 3 ? 'Alege 3 perechi' : n === 1 ? 'Alege perechea' : `Alege ${n} perechi`),
    product: (n?: number) => (n === 1 ? 'Alege produsul' : 'Alege produsele'),
    config: 'Alege configurația',
    add: 'Adaugă',
    added: 'Adăugat',
    mix: 'NEUROS Calm, Focus sau Flow',
    perPair: ' / pereche',
    bundle: '20% la 3 bucăți',
    oneStep: 'Mai ai un pas până la ofertă',
    offer: 'Completează oferta',
    routine: 'Completează rutina',
    optional: 'Opțional',
  },
  en: {
    pairs: (n?: number) => (n === 3 ? 'Choose 3 pairs' : n === 1 ? 'Choose the pair' : `Choose ${n} pairs`),
    product: (n?: number) => (n === 1 ? 'Choose the product' : 'Choose the products'),
    config: 'Choose the configuration',
    add: 'Add',
    added: 'Added',
    mix: 'NEUROS Calm, Focus or Flow',
    perPair: ' / pair',
    bundle: '20% off 3 units',
    oneStep: 'One step away from the offer',
    offer: 'Complete the offer',
    routine: 'Complete your routine',
    optional: 'Optional',
  },
}

/**
 * Compact suggestions ("Completează oferta" / "Completează rutina") from the one recommendation engine (`lib/recommend.ts`).
 * Completing a nearby promotion comes first. Simple products are added in place; NEUROS Amber opens the
 * 2+1 pair picker, NEUROS Flow its configuration picker. Always below or beside the main action,
 * never above it. In the checkout on phones it is folded, so the payment stays close.
 */
export function Suggestions({ placement, className = '' }: { placement: 'cart' | 'checkout'; className?: string }) {
  const { lines, add } = useCart()
  const { openAmber, openBundle, openVariant } = useOfferSheets()
  const locale = useLocale()
  const t = COPY[locale]
  const recs = useMemo(() => recommend(lines.map((l) => ({ productId: l.product.id, variantId: l.variant?.id, quantity: l.quantity })), placement), [lines, placement])
  const [added, setAdded] = useState<string | null>(null)
  const seen = useRef('')

  const ids = recs.map((r) => r.productId).join(',')
  useEffect(() => {
    if (!ids || seen.current === ids) return
    seen.current = ids
    for (const id of ids.split(',')) trackUi('view_cross_sell', { placement, product_id: id })
  }, [ids, placement])

  // Checkout: open from tablets up, folded on phones.
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const hasRecs = recs.length > 0
  useEffect(() => {
    if (hasRecs && detailsRef.current && window.matchMedia('(min-width: 768px)').matches) detailsRef.current.open = true
  }, [hasRecs])

  useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(null), 1800)
    return () => clearTimeout(timer)
  }, [added])

  if (!recs.length) return null

  const act = (r: Recommendation) => {
    trackUi('select_cross_sell', { placement, product_id: r.productId })
    if (r.add === 'amber_pairs') return openAmber(placement, r.slots ?? 3)
    if (r.add === 'bundle') return openBundle(placement)
    if (r.add === 'variant') return openVariant(r.productId, placement)
    if (add(r.productId, undefined, 1, placement === 'cart' ? 'cart_cross_sell' : 'checkout_cross_sell')) {
      trackUi('add_cross_sell', { placement, product_id: r.productId })
      setAdded(r.productId)
    }
  }

  const list = (
    <ul className="divide-y divide-mist-2">
      {recs.map((r) => {
        const p = getProduct(r.productId, locale)!
        const bundle = r.add === 'bundle'
        const label = r.add === 'amber_pairs' ? t.pairs(r.slots) : bundle ? t.product(r.slots) : r.add === 'variant' ? t.config : t.add
        return (
          <li key={r.productId} className="flex items-start gap-3 py-3.5">
            <Thumb image={p.cutout} sizes="64px" className="h-12 w-16 flex-none bg-mist" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-tight font-medium text-ink">{bundle ? t.mix : p.name}</p>
              {!bundle && (
                <p className="mt-0.5 text-[13.5px] leading-snug text-muted tabular-nums">
                  <Price productId={p.id} />
                  {r.add === 'amber_pairs' && t.perPair}
                </p>
              )}
              <p className={`mt-0.5 text-[13px] leading-snug ${r.kind === 'complete_offer' ? 'font-medium text-cyan-700' : 'text-muted'}`}>{reasonText(r, locale)}</p>
              <button type="button" onClick={() => act(r)} className={`btn-secondary sm mt-2.5 !min-h-10 !px-3 !text-[14px] ${added === r.productId ? '!text-cyan-700' : ''}`} aria-label={`${label}: ${bundle ? t.bundle : p.name}`}>
                {added === r.productId ? <Check className="h-4 w-4" /> : r.add === 'direct' ? <Plus className="h-4 w-4" /> : null}
                {added === r.productId ? t.added : label}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )

  // The heading says what the suggestion is for: finishing an offer, or rounding out the routine.
  const offer = recs[0].kind === 'complete_offer'
  const title = offer ? (placement === 'checkout' ? t.oneStep : t.offer) : t.routine
  const heading = <span className="text-[15.5px] font-semibold text-ink">{title}</span>

  if (placement === 'checkout') {
    // Folded on phones (the payment stays in reach), open from tablets up.
    return (
      <details ref={detailsRef} className={`group rounded-[14px] bg-mist px-4 ${className}`}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          {heading}
          <span className="text-[13.5px] text-muted group-open:hidden">{t.optional}</span>
        </summary>
        {list}
      </details>
    )
  }

  return (
    <section aria-label={title} className={className}>
      {heading}
      {list}
    </section>
  )
}
