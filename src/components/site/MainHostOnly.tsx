'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { isGatedHostname, landingForHost } from '@/lib/landing-hosts'

/**
 * True on the price-gated host (acces.) and on the advertising landings (calm., focus., amber.): there the
 * cart lives in that host's own storage and most site pages are on the main host, so links to them would
 * lose the cart (and, on acces, show prices before the form). Read after hydration; the server renders the
 * main-site version.
 */
export function useOffMainHost() {
  const [off, setOff] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOff(isGatedHostname(location.host) || !!landingForHost(location.host))
  }, [])
  return off
}

/** Renders its children only on the main site. */
export function MainHostOnly({ children }: { children: ReactNode }) {
  return useOffMainHost() ? null : <>{children}</>
}
