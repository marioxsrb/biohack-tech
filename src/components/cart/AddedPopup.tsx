'use client'

import Image from 'next/image'
import Link from '@/components/ui/Link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Arrow, Check, Close } from '@/components/ui/icons'
import { useLocale, useUi } from '@/i18n/LocaleProvider'
import { formatLei } from '@/lib/money'
import { useCart } from './CartProvider'
import { LineBundle } from './LineBundle'

const VISIBLE_MS = 15000

/**
 * Compact confirmation after "Adaugă în coș": top right under the header on desktop,
 * a small card at the bottom on phones. It stays until the visitor acts or for about
 * fifteen seconds (it holds the bundle choices); hovering or focusing it pauses the timer. It never takes focus.
 */
export function AddedPopup() {
  const { confirmation, dismissConfirmation, lines } = useCart()
  const line = confirmation ? lines.find((l) => l.key === confirmation.key) : undefined
  const [hold, setHold] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const ui = useUi()
  const en = useLocale() === 'en'
  const shownOn = useRef(pathname)

  // Leaving the page (to the cart, checkout or anywhere else) closes the confirmation.
  useEffect(() => {
    if (confirmation && pathname !== shownOn.current) dismissConfirmation()
    shownOn.current = pathname
  }, [pathname, confirmation, dismissConfirmation])

  useEffect(() => {
    if (!confirmation || hold) return
    const t = setTimeout(dismissConfirmation, VISIBLE_MS)
    return () => clearTimeout(t)
  }, [confirmation, hold, dismissConfirmation])

  useEffect(() => {
    if (!confirmation) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissConfirmation()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmation, dismissConfirmation])

  if (!confirmation || !line) return null
  const img = line.variant?.images[0] ?? line.product.cutout

  return (
    <div
      ref={ref}
      key={confirmation.at}
      role="region"
      aria-label={en ? 'Product added to cart' : 'Produs adăugat în coș'}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => !ref.current?.contains(e.relatedTarget as Node) && setHold(false)}
      className="added-popup fixed z-[260] w-[min(400px,calc(100vw-2*var(--gut)))] rounded-[20px] bg-paper p-5 shadow-[0_24px_60px_-20px_rgba(8,17,19,.35),0_0_0_1px_rgba(8,17,19,.06)] md:top-[calc(var(--nav-h)+12px)] md:right-[max(var(--gut),calc((100vw-1152px)/2+var(--gut)))] max-md:inset-x-[var(--gut)] max-md:bottom-[max(12px,env(safe-area-inset-bottom))] max-md:w-auto"
    >
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2.5 text-[16px] font-semibold text-ink">
          <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-700 text-white">
            <Check className="h-3.5 w-3.5" />
          </span>
          {ui.addedToCart}
        </p>
        <button type="button" onClick={dismissConfirmation} aria-label={ui.close} className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-ink">
          <Close className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-[72px_1fr_auto] items-center gap-4 border-y border-mist-2 py-4">
        <span className="relative block h-14 w-[72px] overflow-hidden rounded-[10px] bg-mist">
          <Image src={img.src} alt="" fill sizes="72px" className={img.kind === 'photo' ? 'object-cover' : `object-contain p-1.5 ${img.bleed === 'bottom' ? 'object-bottom pb-0' : ''}`} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[16px] font-medium text-ink">{line.product.name}</span>
          <span className="block truncate text-[14px] text-muted">
            {[line.variantLabel, line.quantity > 1 ? ui.pieces(line.quantity) : null].filter(Boolean).join(' · ')}
            {!line.variantLabel && line.quantity === 1 ? line.product.purpose : null}
          </span>
        </span>
        <span data-price className="text-[15px] font-medium text-ink tabular-nums">{formatLei(line.unit * line.quantity)}</span>
      </div>

      {/* The product page's bundle choices: 2 or 3 at a lower price, picked right here. */}
      <LineBundle line={line} className="mt-4" />

      <div className="mt-4 grid gap-2">
        <Link href="/checkout" onClick={dismissConfirmation} className="cta w-full">
          {ui.checkout} <Arrow />
        </Link>
        <button type="button" onClick={dismissConfirmation} className="btn-secondary w-full">
          {ui.keepShopping}
        </button>
      </div>
    </div>
  )
}
