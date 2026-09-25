'use client'

import { useRef } from 'react'
import { useScrollVars } from '@/components/motion/scroll-vars'
import { BalanceWaveVisual } from './BalanceWaveVisual'
import { SceneBuy } from './SceneBuy'

/**
 * Balance Wave's moment on its own page. Pinned, so the room darkens and lightens
 * while the scene fills the screen: there is never a dark band to scroll past.
 */
export function BalanceWaveShot() {
  const ref = useRef<HTMLElement>(null)
  useScrollVars(ref)
  return (
    <section ref={ref} data-dark="0.1,0.9" data-theme="light" data-states="bwcopy:0.38-0.85" aria-labelledby="bw-title" className="bw-shot relative">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div aria-hidden className="bw-shot-night absolute inset-0 bg-dark" />
        <BalanceWaveVisual />
        <div className="bw-shot-copy wrap relative pt-[calc(var(--nav-h)+clamp(24px,6vh,72px))]">
          <SceneBuy productId="balance-wave" headingId="bw-title" tone="dark" showLink={false} line="Câteva minute de lumină roșie, la gât. Apoi se oprește singur." />
        </div>
      </div>
    </section>
  )
}
