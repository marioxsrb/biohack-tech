'use client'

import { useEffect } from 'react'
import { getProduct, type ProductId } from '@/content/catalog'
import { itemOf, track, trackFunnel } from '@/lib/analytics'

/**
 * One anonymous count per page load for the funnel comparison in /admin (and one session for the first page of
 * a browser session): no cookie, no id.
 * A visit from a recovery email (?recuperare=1, set by /api/lead/resume) is reported to Meta once and the
 * marker is taken out of the address.
 */
export function VisitBeacon({ page }: { page: string }) {
  useEffect(() => {
    try {
      // The first page of this browser session counts one session; the campaign of the session's first page is
      // kept for its later pages. Only in this tab's storage; nothing that identifies the visitor is sent.
      const params = new URLSearchParams(location.search)
      let session = false
      let source = ''
      let campaign = ''
      try {
        session = !sessionStorage.getItem('bt-visit')
        if (session) sessionStorage.setItem('bt-visit', JSON.stringify({ s: params.get('utm_source') ?? '', c: params.get('utm_campaign') ?? '' }))
        const kept = JSON.parse(sessionStorage.getItem('bt-visit') ?? '{}') as { s?: string; c?: string }
        source = kept.s ?? ''
        campaign = kept.c ?? ''
      } catch {}
      const body = JSON.stringify({ page, session, source, campaign })
      if (!navigator.sendBeacon?.('/api/visit', body)) void fetch('/api/visit', { method: 'POST', body, keepalive: true }).catch(() => {})
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
