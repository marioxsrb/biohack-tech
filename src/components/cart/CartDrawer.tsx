'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { Arrow, Close } from '@/components/ui/icons'
import { productHref, products, type ProductImage } from '@/content/catalog'
import { terms } from '@/config/site'
import { formatLei } from '@/lib/money'
import { useCart } from './CartProvider'
import { Price } from './Price'
import { QuantityStepper } from './QuantityStepper'

/** Small product image on a white tile; cutouts whole, photos cropped. */
function Thumb({ image, className = '' }: { image: ProductImage; className?: string }) {
  return (
    <span className={`relative block overflow-hidden rounded-[12px] bg-paper ${className}`}>
      <Image
        src={image.src}
        alt=""
        fill
        sizes="96px"
        className={image.kind === 'photo' ? 'object-cover' : `object-contain p-2 ${image.bleed === 'bottom' ? 'object-bottom pb-0' : ''}`}
      />
    </span>
  )
}

/**
 * The cart, when the visitor opens it on purpose (the header's "Coș"). Built on <dialog>:
 * focus trap, Escape and inert background come from the platform.
 */
export function CartDrawer() {
  const { isOpen, close, lines, count, total, setQuantity, remove } = useCart()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (isOpen && !d.open) d.showModal()
    if (!isOpen && d.open) d.close()
  }, [isOpen])

  return (
    <dialog
      ref={ref}
      aria-labelledby="cart-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      className="cart-drawer"
    >
      <div className="flex h-full flex-col">
        <header className="flex h-[var(--nav-h)] flex-none items-center justify-between border-b border-line px-6">
          <h2 id="cart-title" className="text-[19px] tracking-[-0.015em]">
            Coșul tău {count > 0 && <span className="text-muted">({count})</span>}
          </h2>
          <button
            type="button"
            onClick={close}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-paper"
            aria-label="Închide coșul"
          >
            <Close className="h-5 w-5" />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col overflow-y-auto px-6 py-10">
            <p className="text-[24px] leading-tight tracking-[-0.02em] text-ink">Coșul tău este gol.</p>
            <p className="mt-2 text-muted">Alege unul dintre cele trei produse.</p>
            <ul className="mt-8 space-y-2">
              {products.map((p) => (
                <li key={p.id}>
                  <Link href={productHref(p)} onClick={close} className="group grid grid-cols-[80px_1fr_auto] items-center gap-4 rounded-[14px] p-2 transition-colors hover:bg-paper">
                    <Thumb image={p.cutout} className="h-16 w-20" />
                    <span>
                      <span className="block font-medium text-ink">{p.name}</span>
                      <span className="block text-[14px] text-muted">
                        {p.purpose} · <Price productId={p.id} />
                      </span>
                    </span>
                    <Arrow className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-6">
              {lines.map((l) => (
                <li key={l.key} className="grid grid-cols-[96px_1fr] gap-4 py-5">
                  <Link href={productHref(l.product)} onClick={close} tabIndex={-1} aria-hidden>
                    <Thumb image={l.variant?.images[0] ?? l.product.cutout} className="h-[76px] w-24" />
                  </Link>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={productHref(l.product)} onClick={close} className="text-[16px] font-medium text-ink hover:underline">
                          {l.product.name}
                        </Link>
                        <p className="text-[14.5px] text-muted">{l.variantLabel ?? l.product.purpose}</p>
                      </div>
                      <p className="flex-none text-right text-[16px] font-medium tabular-nums text-ink">
                        {formatLei(l.unit * l.quantity)}
                        {l.quantity > 1 && <span className="block text-[13px] font-normal text-muted">{formatLei(l.unit)} / buc.</span>}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <QuantityStepper size="sm" value={l.quantity} onChange={(q) => setQuantity(l.key, q)} label={`Cantitate ${l.product.name}`} />
                      <button
                        type="button"
                        onClick={() => remove(l.key)}
                        className="-mr-2 flex min-h-11 items-center rounded px-2 text-[15px] text-muted underline underline-offset-4 hover:text-ink"
                        aria-label={`Elimină ${l.product.name}${l.variantLabel ? `, ${l.variantLabel}` : ''} din coș`}
                      >
                        Elimină
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="flex-none border-t border-line px-6 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
              <dl className="space-y-1.5 text-[15.5px]">
                <div className="flex justify-between">
                  <dt className="text-muted">Livrare</dt>
                  <dd className="text-ink">Gratuită</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="font-medium text-ink">Total</dt>
                  <dd className="text-[22px] font-medium tracking-[-0.02em] text-ink tabular-nums">{formatLei(total)}</dd>
                </div>
              </dl>
              <p className="mt-0.5 text-right text-[13px] text-muted">{terms.vat}</p>
              <Link href="/checkout" onClick={close} className="cta mt-4 w-full">
                Finalizează comanda <Arrow />
              </Link>
              <button type="button" onClick={close} className="mt-2 flex h-11 w-full items-center justify-center text-[15px] font-medium text-muted hover:text-ink">
                Continuă cumpărăturile
              </button>
            </footer>
          </>
        )}
      </div>
    </dialog>
  )
}
