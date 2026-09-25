'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { ProductShot } from '@/components/product/ProductShot'
import { Arrow, Bag, Chevron, Close, Menu } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { site } from '@/config/site'
import { formatMoney } from '@/lib/money'
import { Wordmark } from './Wordmark'

export function Header() {
  const { count, open: openCart } = useCart()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const sheetRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the product menu on Escape or a click outside the nav.
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
        className={`fixed inset-x-0 top-0 z-[250] border-b backdrop-blur-[14px] transition-[background-color,border-color] duration-300 ${
          scrolled || menuOpen ? 'border-dark-line bg-dark/95' : 'border-transparent bg-dark/[.92]'
        }`}
      >
        <nav aria-label="Principal" className="wrap flex h-[var(--nav-h)] items-center gap-8">
          <Link href="/" aria-label={`${site.name}, pagina principală`} className="flex h-11 flex-none items-center">
            <Wordmark />
          </Link>

          <ul className="ml-auto hidden items-center gap-7 text-[14.5px] font-medium md:flex">
            <li>
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-controls="product-menu"
                onClick={() => setMenuOpen((o) => !o)}
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
            <li>
              <Link href="/contact-us" className="nav-link inline-block py-2.5">
                Contact
              </Link>
            </li>
          </ul>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <CartButton count={count} onClick={openCart} />
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

        {/* Desktop product menu */}
        <div
          id="product-menu"
          hidden={!menuOpen}
          className="border-t border-dark-line bg-dark/95 pb-8 pt-6 max-md:hidden"
        >
          <div className="wrap">
            <ul className="grid grid-cols-3 gap-3">
              {products.map((p) => (
                <li key={p.id}>
                  <Link
                    href={productHref(p)}
                    onClick={() => setMenuOpen(false)}
                    className="group grid grid-cols-[112px_1fr] items-center gap-5 rounded-[16px] bg-dark-3 p-2.5 pr-5 transition-colors hover:bg-[#1a2e33]"
                  >
                    <span className="block h-[84px] overflow-hidden rounded-[10px]">
                      <ProductShot image={p.cutout} sizes="112px" inset="sm" />
                    </span>
                    <span>
                      <span className="mono block !text-[11px] !text-dark-muted">{p.category}</span>
                      <span className="mt-1 block font-medium text-white">{p.name}</span>
                      <span className="block text-[14px] text-dark-muted">{formatMoney(p.price)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/products"
              onClick={() => setMenuOpen(false)}
              className="mt-5 inline-flex items-center gap-2 text-[14px] font-medium text-dark-muted hover:text-white"
            >
              Compară produsele <Arrow className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile menu sheet */}
      <dialog ref={sheetRef} aria-label="Meniu" className="menu-sheet on-dark">
        <div className="flex h-full flex-col">
          <div className="wrap flex h-[var(--nav-h)] w-full flex-none items-center justify-between">
            <Link href="/" onClick={closeSheet} aria-label={`${site.name}, pagina principală`}>
              <Wordmark />
            </Link>
            <button
              type="button"
              onClick={closeSheet}
              className="-mr-2.5 flex h-11 w-11 items-center justify-center text-white"
              aria-label="Închide meniul"
            >
              <Close className="h-6 w-6" />
            </button>
          </div>
          <div className="wrap w-full flex-1 overflow-y-auto pb-10">
            <p className="mono mt-4">Produse</p>
            <ul className="mt-3 space-y-2">
              {products.map((p) => (
                <li key={p.id}>
                  <Link
                    href={productHref(p)}
                    onClick={closeSheet}
                    className="grid grid-cols-[96px_1fr_auto] items-center gap-4 rounded-[16px] bg-dark-3 p-2 pr-4"
                  >
                    <span className="block h-[72px] overflow-hidden rounded-[10px]">
                      <ProductShot image={p.cutout} sizes="96px" inset="sm" />
                    </span>
                    <span>
                      <span className="block font-medium text-white">{p.name}</span>
                      <span className="block text-[14px] text-dark-muted">{formatMoney(p.price)}</span>
                    </span>
                    <Arrow className="h-4 w-4 text-dark-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-8 divide-y divide-dark-line border-y border-dark-line text-[20px] tracking-[-0.02em]">
              {[
                ['/products', 'Compară produsele'],
                ['/about-us', 'Despre noi'],
                ['/contact-us', 'Contact'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} onClick={closeSheet} className="flex items-center justify-between py-4 text-white">
                    {label} <Arrow className="h-4 w-4 text-dark-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8 space-y-1 text-[15px] text-dark-muted">
              <a href={`mailto:${site.email}`} className="block py-1 hover:text-white">
                {site.email}
              </a>
              <a href={site.phoneHref} className="block py-1 hover:text-white">
                {site.phone}
              </a>
            </div>
          </div>
        </div>
      </dialog>
    </>
  )
}

function CartButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-11 items-center gap-2 rounded-full px-3 text-white transition-colors hover:bg-white/10"
      aria-label={count ? `Coș, ${count} ${count === 1 ? 'produs' : 'produse'}` : 'Coș, gol'}
    >
      <Bag className="h-[22px] w-[22px]" />
      <span className="hidden text-[14.5px] font-medium sm:inline">Coș</span>
      {count > 0 && (
        <span className="absolute top-1 left-[26px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red px-1 text-[11px] font-semibold tabular-nums text-white sm:static sm:h-5 sm:min-w-5">
          {count}
        </span>
      )}
    </button>
  )
}
