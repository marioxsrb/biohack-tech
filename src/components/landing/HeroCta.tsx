'use client'

import { useRouter } from 'next/navigation'
import { Arrow } from '@/components/ui/icons'
import { getProduct, type ProductId } from '@/content/catalog'
import type { LandingSlug } from '@/lib/landing-hosts'
import { checkoutHref, isPlainClick, startCheckout } from './checkout-link'
import { RevealButton, useGate } from '@/components/gate/Gate'

/**
 * The hero's button. Products without variants go straight to the checkout; the others scroll to the
 * picker, because the customer has to choose first.
 */
export function HeroCta({ slug, productId, label }: { slug: LandingSlug; productId: ProductId; label: string }) {
  const router = useRouter()
  const { locked } = useGate()
  const hasVariants = !!getProduct(productId)?.variants?.length
  // Price-gated funnel: the price comes first, after the short form.
  if (locked) return <RevealButton productId={productId} />
  if (hasVariants) {
    return (
      <a href="#comanda" className="cta">
        {label} <Arrow />
      </a>
    )
  }
  return (
    <a
      href={checkoutHref(slug, { productId })}
      onClick={(e) => {
        if (!isPlainClick(e)) return
        e.preventDefault()
        startCheckout(router.push, slug, { productId })
      }}
      className="cta"
    >
      {label} <Arrow />
    </a>
  )
}
