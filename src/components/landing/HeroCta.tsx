'use client'

import { useRouter } from 'next/navigation'
import { Arrow } from '@/components/ui/icons'
import { getProduct, type ProductId } from '@/content/catalog'
import type { LandingSlug } from '@/lib/landing-hosts'
import { checkoutHref } from './checkout-link'

/**
 * The hero's button. Products without variants go straight to the checkout; the others scroll to the
 * picker, because the customer has to choose first.
 */
export function HeroCta({ slug, productId, label }: { slug: LandingSlug; productId: ProductId; label: string }) {
  const router = useRouter()
  const hasVariants = !!getProduct(productId)?.variants?.length
  if (hasVariants) {
    return (
      <a href="#comanda" className="cta">
        {label} <Arrow />
      </a>
    )
  }
  return (
    <a
      href={checkoutHref(slug, productId)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        router.push(checkoutHref(slug, productId, undefined, { search: window.location.search, host: window.location.host }))
      }}
      className="cta"
    >
      {label} <Arrow />
    </a>
  )
}
