'use client'

import { useEffect } from 'react'
import { getProduct, type ProductId } from '@/content/catalog'
import { itemOf, track, trackFunnel } from '@/lib/analytics'

/**
 * One anonymous count per page load for the funnel comparison in /admin: no cookie, no id, just the page.
 * A visit from a recovery email (?recuperare=1, set by /api/lead/resume) is reported to Meta once and the
 * marker is taken out of the address.
 */
export function VisitBeacon({ page }: { page: string }) {
  useEffect(() => {
    try {
      if (!navigator.sendBeacon?.('/api/visit', page)) void fetch('/api/visit', { method: 'POST', body: page, keepalive: true }).catch(() => {})
    } catch {}
    const url = new URL(location.href)
    if (url.searchParams.has('recuperare')) {
      trackFunnel('RecoveryVisit', { product: page })
      url.searchParams.delete('recuperare')
      history.replaceState(history.state, '', url)
    }
  }, [page])
  return null
}

/** ViewContent on a product page (the landings send theirs from their offer block). Consent-aware like every event. */
export function ProductViewed({ productId }: { productId: ProductId }) {
  useEffect(() => {
    const p = getProduct(productId)
    if (p?.price != null) track('view_item', { value: p.price, items: [itemOf(p)] })
  }, [productId])
  return null
}
