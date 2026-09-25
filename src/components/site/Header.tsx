'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { Bag, Chevron, Close, Menu } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { site } from '@/config/site'
import { formatMoney } from '@/lib/money'
import { Wordmark } from './Wordmark'

/**
 * Three products need no mega-menu: Produse (a short list), Despre noi, Coș.
 * On the homepage the bar is transparent over the hero photograph until you scroll.
 */
export function Header() {
  const { count, open: openCart } = useCart()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const sheetRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

  const overHero = pathname === '/' && !scrolled && !menuOpen
  const closeSheet = () => sheetRef.current?.close()

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[300] rounded-md bg-paper px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Sari la conținut
      </a>
      <header
        ref={navRef}
        onMouseLeave={() => setMenuOpen(false)}
        className={`fixed inset-x-0 top-0 z-[250] transition-[background-color,backdrop-filter] duration-300 ${
          overHero ? 'bg-transparent' : 'bg-dark/95 backdrop-blur-[14px]'
        }`}
      >
        <nav aria-label="Principal" className="wrap flex h-[var(--nav-h)] items-center gap-8">
          <Link href="/" aria-label={`${site.name}, pagina principală`} className="flex h-11 flex-none items-center">
            <Wordmark />
          </Link>

          <ul className="ml-auto hidden items-center gap-8 text-[15px] font-medium md:flex">
            <li>
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-controls="product-menu"
                onClick={() => setMenuOpen((o) => !o)}
                onMouseEnter={() => setMenuOpen(true)}
                className="nav-link flex items-center gap-1.5 py-2.5"
              >
                Produse
                <Chevron className={`h-3.5 w-3.5 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
            </li>
            <li>
              <Link href="/about-us" className="nav-link inline-block py-2.5">
                Despre noi
              </Link>
            </li>
          </ul>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button
              type="button"
              onClick={openCart}
              className="relative flex h-11 items-center gap-2 rounded-full px-3 text-white transition-colors hover:bg-white/10"
              aria-label={count ? `Coș, ${count} ${count === 1 ? 'produs' : 'produse'}` : 'Coș, gol'}
            >
              <Bag className="h-[22px] w-[22px]" />
              <span className="hidden text-[15px] font-medium sm:inline">Coș</span>
              {count > 0 && (
                <span className="absolute top-1 left-[26px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red px-1 text-[11px] font-semibold tabular-nums text-white sm:static sm:h-5 sm:min-w-5">
                  {count}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => sheetRef.current?.showModal()}
              className="-mr-2.5 flex h-11 w-11 items-center justify-center text-white md:hidden"
              aria-label="Deschide meniul"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </nav>

        {/* Product list: three lines of type, nothing more */}
        <div id="product-menu" hidden={!menuOpen} className="border-t border-dark-line max-md:hidden">
          <ul className="wrap grid grid-cols-3 gap-6 py-8">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={productHref(p)} onClick={() => setMenuOpen(false)} className="group block">
                  <span className="block text-[22px] font-medium tracking-[-0.025em] text-white group-hover:text-cyan">{p.name}</span>
                  <span className="mt-1 block text-[14.5px] text-dark-muted">
                    {p.purpose} · {formatMoney(p.price)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <dialog ref={sheetRef} aria-label="Meniu" className="menu-sheet">
        <div className="flex h-full flex-col">
          <div className="wrap flex h-[var(--nav-h)] w-full flex-none items-center justify-between">
            <Link href="/" onClick={closeSheet} aria-label={`${site.name}, pagina principală`} className="flex h-11 items-center">
              <Wordmark />
            </Link>
            <button type="button" onClick={closeSheet} className="-mr-2.5 flex h-11 w-11 items-center justify-center text-white" aria-label="Închide meniul">
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
                      {p.purpose} · {formatMoney(p.price)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-12 space-y-1 text-[18px]">
              <li>
                <Link href="/about-us" onClick={closeSheet} className="block py-2 text-white/85">
                  Despre noi
                </Link>
              </li>
              <li>
                <Link href="/contact-us" onClick={closeSheet} className="block py-2 text-white/85">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </dialog>
    </>
  )
}
