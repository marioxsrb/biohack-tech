'use client'

import type { ReactNode } from 'react'
import type { UiPlacement } from '@/lib/analytics'
import { useOfferSheets } from './OfferSheets'

/** Opens the NEUROS Amber 2+1 pair picker in place, from a server-rendered section. */
export function AmberOfferButton({ placement, className, children }: { placement: UiPlacement; className?: string; children: ReactNode }) {
  const { openAmber } = useOfferSheets()
  return (
    <button type="button" onClick={() => openAmber(placement, 3)} className={className}>
      {children}
    </button>
  )
}
