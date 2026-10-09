'use client'

import type { ReactNode } from 'react'
import type { UiPlacement } from '@/lib/analytics'
import { useOfferSheets } from './OfferSheets'

/**
 * Opens an offer's picker in place (NEUROS Amber 2+1 or the quantity discount) from a server-rendered
 * section: used for the offer's image and its button, so both do the same thing.
 */
export function OfferTrigger({ offer, placement, className, label, children }: { offer: 'amber' | 'bundle'; placement: UiPlacement; className?: string; label?: string; children: ReactNode }) {
  const { openAmber, openBundle } = useOfferSheets()
  return (
    <button type="button" aria-label={label} onClick={() => (offer === 'amber' ? openAmber(placement, 3) : openBundle(placement))} className={className}>
      {children}
    </button>
  )
}
