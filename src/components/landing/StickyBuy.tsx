'use client'

import { useEffect, useState } from 'react'
import { Price } from '@/components/cart/Price'
import type { ProductId } from '@/content/catalog'

/**
 * Phones and tablets: a slim purchase bar once the hero is gone, hidden again while the purchase block
 * itself is on screen (never two buttons for the same thing). It only scrolls to the purchase block.
 */
export function StickyBuy({ name, productId, cta }: { name: string; productId: ProductId; cta: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const hero = document.getElementById('lp-hero')
    const buy = document.getElementById('comanda')
    if (!hero || !buy) return
    const seen = new Map<Element, boolean>()
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target, e.isIntersecting))
      setShow(!seen.get(hero) && !seen.get(buy))
    })
    io.observe(hero)
    io.observe(buy)
    return () => io.disconnect()
  }, [])
  return (
    <div
      aria-hidden={!show}
      inert={!show}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--lp-line)] bg-[var(--lp-bg)]/95 backdrop-blur-md transition-transform duration-300 ease-[var(--ease-brand)] lg:hidden ${show ? 'translate-y-0' : 'translate-y-full'}`}
    >
      <div className="lp-wrap flex items-center gap-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-[var(--lp-ink)]">{name}</p>
          <p className="text-[14px] text-[var(--lp-muted)] tabular-nums">
            <Price productId={productId} pendingClassName="" />
          </p>
        </div>
        <a href="#comanda" className="cta sm !min-h-12">
          {cta}
        </a>
      </div>
    </div>
  )
}
