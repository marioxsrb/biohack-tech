'use client'

import { useEffect, useState } from 'react'
import { Check, Mail, Plus } from '@/components/ui/icons'
import { getProduct, isPurchasable, type ProductId } from '@/content/catalog'
import { site } from '@/config/site'
import { useCart } from './CartProvider'

type Props = {
  productId: ProductId
  variantId?: string
  quantity?: number
  className?: string
  size?: 'sm' | 'md'
  /** Called after a successful add (e.g. to reset a quantity stepper). */
  onAdded?: () => void
}

/**
 * The one "Adaugă în coș" button of the site. Click → pressed → check + "Adăugat în coș"
 * for two seconds. Both labels share one grid cell, so the button never changes width.
 * A product without an approved price shows an honest "Întreabă de preț" link instead.
 */
export function AddToCartButton({ productId, variantId, quantity = 1, className = '', size = 'md', onAdded }: Props) {
  const { add } = useCart()
  const [added, setAdded] = useState(false)
  const product = getProduct(productId)!

  useEffect(() => {
    if (!added) return
    const t = setTimeout(() => setAdded(false), 2000)
    return () => clearTimeout(t)
  }, [added])

  if (!isPurchasable(product)) {
    return (
      <a href={`mailto:${site.email}?subject=${encodeURIComponent(`Preț ${product.name}`)}`} className={`btn-secondary ${size === 'sm' ? 'sm' : ''} ${className}`}>
        <Mail /> Întreabă de preț
      </a>
    )
  }

  return (
    <button
      type="button"
      className={`cta ${size === 'sm' ? 'sm' : ''} ${added ? 'is-done' : ''} ${className}`}
      onClick={() => {
        if (add(productId, variantId, quantity)) {
          setAdded(true)
          onAdded?.()
        }
      }}
    >
      <span className="grid">
        <span className={`flex items-center justify-center gap-[inherit] [grid-area:1/1] transition-opacity duration-150 ${added ? 'invisible opacity-0' : ''}`}>
          Adaugă în coș <Plus />
        </span>
        <span aria-hidden={!added} className={`flex items-center justify-center gap-[inherit] [grid-area:1/1] transition-opacity duration-150 ${added ? '' : 'invisible opacity-0'}`}>
          <Check className="check-pop" /> Adăugat în coș
        </span>
      </span>
    </button>
  )
}
