'use client'

import { GateLabel } from '@/components/gate/GateLabel'
import { useEffect, useState } from 'react'
import { Check, Mail, Plus } from '@/components/ui/icons'
import { getProduct, isPurchasable, type ProductId } from '@/content/catalog'
import { site } from '@/config/site'
import { useLocale, useUi } from '@/i18n/LocaleProvider'
import { useCart } from './CartProvider'

type Props = {
  productId: ProductId
  variantId?: string
  quantity?: number
  className?: string
  size?: 'sm' | 'md'
  /** `secondary`: outlined, beside a red "Comandă acum" that already is the main action. */
  tone?: 'primary' | 'secondary'
  /** Called after a successful add (e.g. to reset a quantity stepper). */
  onAdded?: () => void
}

/**
 * The one "Adaugă în coș" button of the site. Click → pressed → check + "Adăugat în coș"
 * for two seconds. Both labels share one grid cell, so the button never changes width.
 * A product without an approved price shows an honest "Întreabă de preț" link instead.
 */
export function AddToCartButton({ productId, variantId, quantity = 1, className = '', size = 'md', tone = 'primary', onAdded }: Props) {
  const { add } = useCart()
  const [added, setAdded] = useState(false)
  const locale = useLocale()
  const ui = useUi()
  const product = getProduct(productId, locale)!

  useEffect(() => {
    if (!added) return
    const t = setTimeout(() => setAdded(false), 2000)
    return () => clearTimeout(t)
  }, [added])

  if (!isPurchasable(product)) {
    return (
      <a href={`mailto:${site.email}?subject=${encodeURIComponent(`${locale === 'en' ? 'Price' : 'Preț'} ${product.name}`)}`} className={`btn-secondary ${size === 'sm' ? 'sm' : ''} ${className}`}>
        <Mail /> {ui.askPrice}
      </a>
    )
  }

  return (
    <button
      type="button"
      data-buy
      data-product={productId}
      data-variant={variantId}
      className={`${tone === 'secondary' ? 'btn-secondary' : 'cta'} ${size === 'sm' ? 'sm' : ''} ${added && tone === 'primary' ? 'is-done' : ''} ${className}`}
      onClick={() => {
        if (add(productId, variantId, quantity)) {
          setAdded(true)
          onAdded?.()
        }
      }}
    >
      <span className="grid">
        <span className={`flex items-center justify-center gap-[inherit] [grid-area:1/1] transition-opacity duration-150 ${added ? 'invisible opacity-0' : ''}`}>
          <GateLabel locked={locale === 'en' ? 'See the price' : 'Vezi prețul'}>
            {ui.addToCart} <Plus />
          </GateLabel>
        </span>
        <span aria-hidden={!added} className={`flex items-center justify-center gap-[inherit] [grid-area:1/1] transition-opacity duration-150 ${added ? '' : 'invisible opacity-0'}`}>
          <Check className="check-pop" /> {ui.addedToCart}
        </span>
      </span>
    </button>
  )
}
