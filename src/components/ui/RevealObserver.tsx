'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Fades `.rev` elements in as they enter the viewport. The hidden state only
 * applies under `html.js`, so content is always visible without JavaScript.
 */
export function RevealObserver() {
  const pathname = usePathname()

  useEffect(() => {
    const els = document.querySelectorAll('.rev:not(.in)')
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [pathname])

  return null
}
