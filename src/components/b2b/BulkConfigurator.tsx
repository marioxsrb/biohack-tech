'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cartStore, lineKey } from '@/components/cart/cart-store'
import { Arrow, Lock, Minus, Plus } from '@/components/ui/icons'
import { BULK_OFFER } from '@/config/promotions'
import { getProduct, type ProductId } from '@/content/catalog'
import { useLocale } from '@/i18n/LocaleProvider'
import { useMoney } from '@/i18n/currency'
import { localePath } from '@/i18n/locales'
import { BULK_MAX_QTY } from '@/lib/purchase'
import { bulkUnits, priceLines } from '@/lib/promotions'

const COPY = {
  ro: {
    pick: 'Alege cantitățile',
    each: 'bucata',
    units: (n: number) => (n === 1 ? '1 bucată' : `${n} bucăți`),
    progress: (n: number, min: number) => `${n} din ${min} bucăți eligibile`,
    missing: (n: number) => `Mai adaugă ${n === 1 ? 'o bucată' : `${n} bucăți`} NEUROS Calm sau Focus pentru reducerea de 40%.`,
    unlocked: 'Reducerea de 40% se aplică la toate bucățile NEUROS Calm și Focus.',
    summary: 'Sumarul comenzii',
    original: 'Subtotal inițial',
    discount: 'Reducere pentru companii (40%)',
    after: 'Subtotal după reducere',
    delivery: 'Livrare',
    free: 'Gratuită',
    total: 'Total',
    vat: 'din care TVA 21%',
    saving: (x: string) => `Economisești ${x}.`,
    cta: 'Continuă la comandă',
    ctaHint: 'La pasul următor completezi datele firmei (CUI) și alegi plata: card, transfer bancar sau ramburs.',
    quantity: (name: string) => `Cantitate ${name}`,
    less: 'Scade',
    more: 'Crește',
    max: (n: number) => `Cel mult ${n} bucăți din fiecare produs online. Pentru mai mult, scrie-ne.`,
  },
  en: {
    pick: 'Choose the quantities',
    each: 'each',
    units: (n: number) => (n === 1 ? '1 unit' : `${n} units`),
    progress: (n: number, min: number) => `${n} of ${min} eligible units`,
    missing: (n: number) => `Add ${n === 1 ? 'one more unit' : `${n} more units`} of NEUROS Calm or Focus for the 40% discount.`,
    unlocked: 'The 40% discount applies to every NEUROS Calm and Focus unit.',
    summary: 'Order summary',
    original: 'Original subtotal',
    discount: 'Business discount (40%)',
    after: 'Subtotal after discount',
    delivery: 'Delivery',
    free: 'Free',
    total: 'Total',
    vat: 'of which VAT 21%',
    saving: (x: string) => `You save ${x}.`,
    cta: 'Continue to checkout',
    ctaHint: 'At the next step you enter your company details and choose how to pay.',
    quantity: (name: string) => `Quantity of ${name}`,
    less: 'Decrease',
    more: 'Increase',
    max: (n: number) => `At most ${n} units of each product online. For more, write to us.`,
  },
}

const PRESETS = [25, 50, 100]
const vatIn = (minor: number) => minor - Math.round(minor / 1.21)

/**
 * The business order builder: Calm and Focus quantities, the live summary priced by the same engine as the cart and
 * the server (lib/promotions.ts), and the hand-off to the normal checkout. Only product ids and quantities go to the
 * cart; the server prices the order again and decides the discount.
 */
export function BulkConfigurator() {
  const locale = useLocale()
  const t = COPY[locale]
  const { fmt, unit } = useMoney()
  const router = useRouter()
  const ids = BULK_OFFER.products as ProductId[]
  const [qty, setQty] = useState<Record<string, number>>({ [ids[0]]: 15, [ids[1]]: 10 })
  const set = (id: string, n: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(BULK_MAX_QTY, Math.floor(n) || 0)) }))

  const items = ids.map((id) => ({ product: getProduct(id, locale)!, quantity: qty[id] ?? 0 })).filter((x) => x.product && x.product.price !== null)
  const lines = items.filter((x) => x.quantity > 0).map((x) => ({ key: x.product.id, productId: x.product.id, quantity: x.quantity, unitAmount: unit(x.product.price!) }))
  const pricing = priceLines(lines)
  const units = bulkUnits(lines)
  const missing = Math.max(0, BULK_OFFER.minUnits - units)
  const ready = missing === 0

  const go = () => {
    if (!ready) return
    // The chosen quantities replace any Calm/Focus already in the cart; other products stay as they were.
    cartStore.put(lines.map((l) => ({ productId: l.productId as ProductId, quantity: l.quantity, source: 'business' as const })))
    for (const x of items) if (!x.quantity) cartStore.remove(lineKey({ productId: x.product.id }))
    router.push(localePath(locale, '/checkout'))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <h3 className="text-[15px] font-semibold tracking-[0.08em] text-cyan-700 uppercase">{t.pick}</h3>
        <div className="mt-4 grid gap-4">
          {items.map(({ product: p, quantity }) => (
            <div key={p.id} className="flex flex-wrap items-center gap-5 rounded-[22px] bg-paper p-5 shadow-[0_0_0_1px_var(--color-line)] sm:flex-nowrap">
              <div className="relative h-24 w-24 flex-none overflow-hidden rounded-[16px] bg-mist">
                <Image src={p.cutout.src} alt={p.cutout.alt} fill sizes="96px" className={`object-contain p-[10%] ${p.cutout.bleed === 'bottom' ? 'object-bottom pb-0' : ''}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[19px] font-semibold tracking-[-0.01em] text-ink">{p.name}</p>
                <p className="mt-0.5 text-[14.5px] text-muted">{p.purpose}</p>
                <p className="mt-2 text-[14.5px] text-text tabular-nums">
                  <span className="text-muted line-through">{fmt(unit(p.price!))}</span>{' '}
                  <span className="font-semibold text-ink">{fmt(unit(p.price!) - Math.floor((unit(p.price!) * BULK_OFFER.percent + 50) / 100))}</span> / {t.each}
                </p>
              </div>
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                <div role="group" aria-label={t.quantity(p.name)} className="inline-flex h-12 items-center self-start rounded-[12px] bg-white shadow-[inset_0_0_0_1px_var(--color-line)] sm:self-end">
                  <button type="button" aria-label={t.less} onClick={() => set(p.id, quantity - 1)} disabled={quantity <= 0} className="flex h-full w-11 items-center justify-center rounded-l-[12px] text-ink hover:bg-paper disabled:text-muted">
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={BULK_MAX_QTY}
                    value={quantity}
                    onChange={(e) => set(p.id, Number(e.target.value))}
                    aria-label={t.quantity(p.name)}
                    className="h-full w-16 [appearance:textfield] bg-transparent text-center text-[17px] font-semibold text-ink tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button type="button" aria-label={t.more} onClick={() => set(p.id, quantity + 1)} disabled={quantity >= BULK_MAX_QTY} className="flex h-full w-11 items-center justify-center rounded-r-[12px] text-ink hover:bg-paper disabled:text-muted">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  {PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set(p.id, n)}
                      aria-pressed={quantity === n}
                      className={`min-h-9 rounded-full px-3 text-[13.5px] font-medium tabular-nums transition-colors ${quantity === n ? 'bg-ink text-white' : 'bg-mist text-ink hover:bg-mist-2'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13.5px] text-muted">{t.max(BULK_MAX_QTY)}</p>
      </div>

      <aside aria-live="polite" className="lg:col-span-5">
        <div className="rounded-[24px] bg-ink p-6 text-white sm:p-7 lg:sticky lg:top-[calc(var(--nav-h)+24px)]">
          <h3 className="text-[15px] font-semibold tracking-[0.08em] text-cyan-300 uppercase">{t.summary}</h3>
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-[14.5px] text-white/70">
              <span>{t.progress(units, BULK_OFFER.minUnits)}</span>
              <span className="tabular-nums">{Math.min(100, Math.round((units / BULK_OFFER.minUnits) * 100))}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div className={`h-full rounded-full transition-[width] duration-300 ${ready ? 'bg-cyan-300' : 'bg-white/60'}`} style={{ width: `${Math.min(100, (units / BULK_OFFER.minUnits) * 100)}%` }} />
            </div>
            <p className={`mt-3 text-[14.5px] leading-snug ${ready ? 'text-cyan-200' : 'text-white/80'}`}>{ready ? t.unlocked : t.missing(missing)}</p>
          </div>
          <dl className="mt-6 space-y-2.5 border-t border-white/15 pt-5 text-[15.5px]">
            {items
              .filter((x) => x.quantity > 0)
              .map((x) => (
                <div key={x.product.id} className="flex justify-between gap-3 text-white/80">
                  <dt>
                    {x.quantity} × {x.product.name}
                  </dt>
                  <dd className="tabular-nums">{fmt(unit(x.product.price!) * x.quantity)}</dd>
                </div>
              ))}
            <div className="flex justify-between pt-2">
              <dt className="text-white/70">{t.original}</dt>
              <dd className="tabular-nums">{fmt(pricing.subtotalMinor)}</dd>
            </div>
            {pricing.promotions.map((p) => (
              <div key={p.id} className="flex justify-between gap-3 font-semibold text-cyan-300">
                <dt>{p.id === BULK_OFFER.id ? t.discount : p.label}</dt>
                <dd className="tabular-nums whitespace-nowrap">−{fmt(p.amountMinor)}</dd>
              </div>
            ))}
            <div className="flex justify-between">
              <dt className="text-white/70">{t.after}</dt>
              <dd className="tabular-nums">{fmt(pricing.totalMinor)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/70">{t.delivery}</dt>
              <dd>{t.free}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-white/15 pt-3">
              <dt className="font-medium">{t.total}</dt>
              <dd className="text-[30px] font-medium tracking-[-0.02em] tabular-nums">{fmt(pricing.totalMinor)}</dd>
            </div>
            <div className="flex justify-between text-[13.5px] text-white/60">
              <dt>{t.vat}</dt>
              <dd className="tabular-nums">{fmt(vatIn(pricing.totalMinor))}</dd>
            </div>
          </dl>
          {ready && pricing.discountMinor > 0 && <p className="mt-4 text-[15px] font-medium text-cyan-200">{t.saving(fmt(pricing.discountMinor))}</p>}
          <button type="button" onClick={go} disabled={!ready} className="cta mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50">
            <Lock /> {t.cta} <Arrow />
          </button>
          <p className="mt-3 text-[13.5px] leading-snug text-white/60">{t.ctaHint}</p>
        </div>
      </aside>
    </div>
  )
}
