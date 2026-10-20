'use client'

import Image from 'next/image'
import Link from '@/components/ui/Link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { Bag, Chevron, Close, Menu } from '@/components/ui/icons'
import { productHref, productsIn } from '@/content/catalog'
import { Price } from '@/components/cart/Price'
import { useLocale, useUi } from '@/i18n/LocaleProvider'
import { splitLocale } from '@/i18n/locales'
import { CurrencySwitch, LanguageSwitch } from './LanguageSwitch'
import { useOffMainHost } from './MainHostOnly'
import { Wordmark } from './Wordmark'

const COPY = {
  ro: { nav: 'Principal', products: 'Produse', business: 'Pentru companii', businessHref: '/pentru-companii', about: 'Despre noi', contact: 'Contact', cart: 'Coș', cartLabel: (n: number) => (n ? `Coș, ${n} ${n === 1 ? 'produs' : 'produse'}` : 'Coș, gol'), openMenu: 'Deschide meniul', closeMenu: 'Închide meniul', menu: 'Meniu' },
  en: { nav: 'Main', products: 'Products', business: 'For business', businessHref: '/for-business', about: 'About us', contact: 'Contact', cart: 'Cart', cartLabel: (n: number) => (n ? `Cart, ${n} ${n === 1 ? 'item' : 'items'}` : 'Cart, empty'), openMenu: 'Open the menu', closeMenu: 'Close the menu', menu: 'Menu' },
}

/**
 * Four products need no mega-menu: Produse (a short list), Despre noi, Coș.
 * Two predictable states: over the homepage photograph (transparent, white text; a dark
 * translucent bar on phones) and everywhere else (solid light bar). One IntersectionObserver.
 */
export function Header() {
  const { count } = useCart()
  const pathname = usePathname()
  const locale = useLocale()
  const t = COPY[locale]
  const ui = useUi()
  const products = productsIn(locale)
  const [overHero, setOverHero] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  // On the landing hosts: brand and cart only (the rest is on the main site, with another cart).
  const offMain = useOffMainHost()
  const sheetRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const end = document.getElementById('hero-end')
    if (!end) return
    // Over the photograph until the point where the product panels start has passed under the bar.
    const io = new IntersectionObserver(([e]) => setOverHero(e.boundingClientRect.top > 64))
    io.observe(end)
    return () => io.disconnect()
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [menuOpen])

  // Only the homepage has the photograph; elsewhere the bar is always the light one.
  const dark = overHero && splitLocale(pathname).path === '/' && !menuOpen
  const closeSheet = () => sheetRef.current?.close()

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[500] rounded-md bg-paper px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {ui.skipToContent}
      </a>
      <header
        ref={navRef}
        onMouseLeave={() => setMenuOpen(false)}
        className={`fixed inset-x-0 top-0 z-[100] transition-[background-color,color,box-shadow] duration-300 ${
          dark
            ? 'text-white max-md:bg-dark/70 max-md:backdrop-blur-[10px] md:bg-transparent'
            : 'bg-mist/95 text-ink shadow-[0_1px_0_rgb(8_17_19/0.07)] backdrop-blur-[14px]'
        }`}
      >
        <nav aria-label={t.nav} className="wrap flex h-[var(--nav-h)] items-center gap-8">
          <Link href="/" className="flex h-11 flex-none items-center">
            <Wordmark tone={dark ? 'dark' : 'light'} />
          </Link>

          <ul className={`ml-auto hidden items-center gap-8 text-[15px] font-medium ${offMain ? '' : 'md:flex'}`}>
            <li>
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-controls="product-menu"
                onClick={() => setMenuOpen((o) => !o)}
                onMouseEnter={() => setMenuOpen(true)}
                className="nav-link flex items-center gap-1.5 py-2.5"
              >
                {t.products}
                <Chevron className={`h-3.5 w-3.5 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
            </li>
            <li>
              <Link href={t.businessHref} className="nav-link inline-flex items-center gap-1.5 py-2.5">
                {t.business}
                <span className="rounded-full bg-cyan-300/90 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-ink">−40%</span>
              </Link>
            </li>
            <li>
              <Link href="/about-us" className="nav-link inline-block py-2.5">
                {t.about}
              </Link>
            </li>
            <li>
              <Link href="/contact-us" className="nav-link inline-block py-2.5">
                {t.contact}
              </Link>
            </li>
          </ul>

          <div className={`ml-auto flex items-center gap-1 ${offMain ? '' : 'md:ml-0'}`}>
            {!offMain && <CurrencySwitch dark={dark} className="mr-1.5 max-sm:hidden" />}
            {!offMain && <LanguageSwitch dark={dark} className="mr-2 max-md:mr-1" />}
            <Link
              href="/cart"
              className={`relative -mr-3 flex h-11 items-center gap-2 rounded-full px-3 transition-colors max-md:mr-0 ${dark ? 'hover:bg-white/10' : 'hover:bg-ink/5'}`}
              aria-label={t.cartLabel(count)}
            >
              <Bag className="h-[22px] w-[22px]" />
              <span className="text-[15px] font-medium max-[380px]:sr-only">{t.cart}</span>
              {count > 0 && (
                <span key={count} className="cart-bump flex h-5 min-w-5 items-center justify-center rounded-full bg-red-dark px-1.5 text-[12px] font-semibold tabular-nums text-white">
                  {count}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => sheetRef.current?.showModal()}
              className={`-mr-2.5 h-11 w-11 items-center justify-center md:hidden ${offMain ? 'hidden' : 'flex'}`}
              aria-label={t.openMenu}
              aria-haspopup="dialog"
              aria-controls="meniu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </nav>

        {/* Product list: one line per product, in the bar's own colours */}
        <div id="product-menu" hidden={!menuOpen || offMain} className={`max-md:hidden ${dark ? 'shadow-[0_-1px_0_var(--color-dark-line)]' : 'shadow-[0_-1px_0_rgb(8_17_19/0.06)]'}`}>
          <ul className="wrap grid grid-cols-2 gap-x-6 gap-y-2 py-6 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={productHref(p)} onClick={() => setMenuOpen(false)} className="group flex items-center gap-4 rounded-[16px] p-2 transition-colors hover:bg-paper">
                  <span className="relative block h-[72px] w-[92px] flex-none overflow-hidden rounded-[12px] bg-paper">
                    <Image
                      src={p.cutout.src}
                      alt=""
                      fill
                      sizes="92px"
                      className={`object-contain p-2 ${p.cutout.bleed === 'bottom' ? 'object-bottom pb-0' : ''}`}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[19px] font-medium tracking-[-0.02em] group-hover:text-cyan-700">{p.name}</span>
                    <span className="mt-0.5 block text-[14.5px] text-muted">
                      {p.purpose} · <Price productId={p.id} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <dialog ref={sheetRef} id="meniu" aria-label={t.menu} className="menu-sheet">
        <div className="flex h-full flex-col">
          <div className="wrap flex h-[var(--nav-h)] w-full flex-none items-center justify-between">
            <Link href="/" onClick={closeSheet} className="flex h-11 items-center">
              <Wordmark tone="dark" />
            </Link>
            <button type="button" onClick={closeSheet} className="-mr-2.5 flex h-11 w-11 items-center justify-center text-white" aria-label={t.closeMenu}>
              <Close className="h-6 w-6" />
            </button>
          </div>
          <div className="wrap flex w-full flex-1 flex-col overflow-y-auto pt-8 pb-10">
            <ul className="space-y-6">
              {products.map((p) => (
                <li key={p.id}>
                  <Link href={productHref(p)} onClick={closeSheet} className="block">
                    <span className="block text-[34px] leading-none font-medium tracking-[-0.035em] text-white">{p.name}</span>
                    <span className="mt-2 block text-[15px] text-dark-muted">
                      {p.purpose} · <Price productId={p.id} pendingClassName="" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <CurrencySwitch dark className="mt-10 w-fit sm:hidden" />
            <ul className="mt-12 space-y-1 text-[18px]">
              <li>
                <Link href={t.businessHref} onClick={closeSheet} className="flex items-center gap-2 py-2 text-white">
                  {t.business}
                  <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-[12px] font-semibold text-ink">{locale === 'en' ? '−40% from 25 units' : '−40% de la 25 buc.'}</span>
                </Link>
              </li>
              <li>
                <Link href="/about-us" onClick={closeSheet} className="block py-2 text-white/85">
                  {t.about}
                </Link>
              </li>
              <li>
                <Link href="/contact-us" onClick={closeSheet} className="block py-2 text-white/85">
                  {t.contact}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </dialog>
    </>
  )
}
