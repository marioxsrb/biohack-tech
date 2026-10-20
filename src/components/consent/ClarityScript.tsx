'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { consentStore } from '@/lib/consent/store'
import { claritySnippet, vendorsToLoad } from '@/lib/consent/vendors'

/**
 * Microsoft Clarity, once, for the main site and every product landing (amber, calm, focus).
 * The snippet stays out of the HTML until the visitor allows analytics, the same rule as the Meta
 * Pixel uses for marketing. Private pages, including /admin in either language, never get the tag.
 */
export function ClarityScript() {
  const stored = useSyncExternalStore(consentStore.subscribe, consentStore.get, consentStore.getServer)
  const pathname = usePathname() ?? '/'
  const vendor = vendorsToLoad(stored, pathname).find((v) => v.id === 'clarity')
  if (!vendor?.key) return null
  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {claritySnippet(vendor.key)}
    </Script>
  )
}
