'use client'

import { useRouter } from 'next/navigation'
import { Arrow } from '@/components/ui/icons'
import { getProduct, type ProductId } from '@/content/catalog'
import type { LandingSlug } from '@/lib/landing-hosts'
import { checkoutHref, isPlainClick, startCheckout } from './checkout-link'

/**
 * The hero's button. Products without variants go straight to the checkout; the others scroll to the
 * picker, because the customer has to choose first.
 */
export function HeroCta({ slug, productId, label, className = '' }: { slug: LandingSlug; productId: ProductId; label: string; className?: string }) {
  const router = useRouter()
  const hasVariants = !!getProduct(productId)?.variants?.length
  if (hasVariants) {
    return (
      <a href="#comanda" className={`cta ${className}`}>
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
      className={`cta ${className}`}
    >
      {label} <Arrow />
    </a>
  )
}
