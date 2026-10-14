'use client'

import { useEffect, useState } from 'react'
import { Price } from '@/components/cart/Price'
import type { ProductId } from '@/content/catalog'
import { RevealButton, useGate } from '@/components/gate/Gate'

/**
 * Phones and tablets: a slim purchase bar once the hero is gone, hidden again while the purchase block
 * itself is on screen (never two buttons for the same thing). It only scrolls to the purchase block.
 */
export function StickyBuy({ name, productId, cta }: { name: string; productId: ProductId; cta: string }) {
  const [show, setShow] = useState(false)
  const { locked } = useGate()
  useEffect(() => {
    const hero = document.getElementById('lp-hero')
    const buy = document.getElementById('comanda')
    if (!hero || !buy) return
    // Hidden where the page already offers the action or needs the space: the hero, the purchase block,
    // the help form and the closing call to action.
    const watched = [hero, buy, document.getElementById('ajutor'), document.getElementById('final')].filter((e): e is HTMLElement => !!e)
    const seen = new Map<Element, boolean>()
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target, e.isIntersecting))
      setShow(watched.every((e) => !seen.get(e)))
    })
    watched.forEach((e) => io.observe(e))
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
          {!locked && (
            <p className="text-[14px] text-[var(--lp-muted)] tabular-nums">
              <Price productId={productId} pendingClassName="" />
            </p>
          )}
        </div>
        {locked ? (
          <RevealButton productId={productId} className="cta sm !min-h-12" label="Vezi prețul" />
        ) : (
          <a href="#comanda" className="cta sm !min-h-12">
            {cta}
          </a>
        )}
      </div>
    </div>
  )
}
