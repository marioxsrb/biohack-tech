'use client'

/**
 * The pieces of the product page's buy column, designed together (ProductHero puts them in order):
 * social proof, highlights, the price, availability, the bundle offers, ordering by phone or WhatsApp,
 * and the four store promises. Every number shown comes from config: prices (config/prices.ts),
 * promotions (config/promotions.ts), the customer count (config/social-proof.ts), contact and the
 * commercial terms (config/site.ts), cash on delivery (config/payments.ts). Nothing is shown without its data.
 */
import type { ComponentType, SVGProps } from 'react'
import { Price } from '@/components/cart/Price'
import { useOfferSheets } from '@/components/offers/OfferSheets'
import { Check, Lock, Phone, Return, ShieldCheck, Truck, Users, Wallet, WhatsApp } from '@/components/ui/icons'
import { cashOnDelivery } from '@/config/payments'
import { promoText } from '@/config/promotions'
import { socialProof } from '@/config/social-proof'
import { site, terms } from '@/config/site'
import { getProduct, getVariant, isBook, unitPrice, variantLabel, type ProductId } from '@/content/catalog'
import { useLocale, useUi } from '@/i18n/LocaleProvider'
import { useMoney } from '@/i18n/currency'
import { priceLines, promotionFor } from '@/lib/promotions'
import { customersLine } from '@/lib/social-proof'

const COPY = {
  ro: {
    highlights: 'Pe scurt',
    save: (s: string) => `Economisești ${s}`,
    bundleHead: 'Cumperi mai multe, plătești mai puțin',
    bundleLine: (n: number, p: number) => `Cumperi ${n} și economisești ${p}%`,
    bundleNote: 'Reducerea se aplică doar la bucățile din acest produs, nu la restul comenzii.',
    amberHead: 'Alege 3 perechi. Plătești 2.',
    amberLine: 'Cumperi 3, plătești 2',
    amberNote: 'La fiecare 3 perechi, una este gratuită.',
    amberMix: 'Combină ramele',
    pieces: (n: number) => (n === 1 ? '1 bucată' : `${n} bucăți`),
    pairs: (n: number) => (n === 1 ? '1 pereche' : `${n} perechi`),
    inStock: 'În stoc',
    soldOut: 'Stoc epuizat momentan',
    ships: `Expediem în ${terms.processingDays}`,
    contact: 'Comandă direct, cu ajutorul nostru',
    order: 'Comandă',
    phone: 'telefonic',
    whatsapp: 'pe WhatsApp',
    newTab: ' (se deschide WhatsApp)',
    waMessage: (product: string, variant: string | null, qty: number) =>
      `Bună ziua! Aș dori să plasez o comandă:\n- Produs: ${product}${variant ? `\n- Varianta: ${variant}` : ''}\n- Cantitate: ${qty}\nMă puteți ajuta să o finalizez?`,
    securePay: 'Plată securizată',
    payOnDelivery: 'Plată la livrare',
    promises: 'Cumperi în siguranță',
    bookDelivery: 'Livrare o dată pe comandă',
    pdfIncluded: 'PDF inclus',
  },
  en: {
    highlights: 'In short',
    save: (s: string) => `You save ${s}`,
    bundleHead: 'Buy more, pay less',
    bundleLine: (n: number, p: number) => `Buy ${n} and save ${p}%`,
    bundleNote: 'The discount applies only to the units of this product, not to the rest of the order.',
    amberHead: 'Choose 3 pairs. Pay for 2.',
    amberLine: 'Buy 3, pay for 2',
    amberNote: 'In every 3 pairs, one is free.',
    amberMix: 'Mix the frames',
    pieces: (n: number) => (n === 1 ? '1 piece' : `${n} pieces`),
    pairs: (n: number) => (n === 1 ? '1 pair' : `${n} pairs`),
    inStock: 'In stock',
    soldOut: 'Temporarily out of stock',
    ships: `Ships in ${terms.processingDays.replace('zile', 'days')}`,
    contact: 'Order directly, with our help',
    order: 'Order',
    phone: 'by phone',
    whatsapp: 'on WhatsApp',
    newTab: ' (opens WhatsApp)',
    waMessage: (product: string, variant: string | null, qty: number) =>
      `Hello! I would like to place an order:\n- Product: ${product}${variant ? `\n- Option: ${variant}` : ''}\n- Quantity: ${qty}\nCan you help me complete it?`,
    securePay: 'Secure payment',
    payOnDelivery: 'Pay on delivery',
    promises: 'Buy with confidence',
    bookDelivery: 'One delivery fee per order',
    pdfIncluded: 'PDF included',
  },
}

/** Near the title, small: how many customers have bought. Hidden until the number is confirmed. */
export function SocialProof({ className = '' }: { className?: string }) {
  const locale = useLocale()
  const n = socialProof.customers
  if (!n || n <= 0) return null
  return (
    <p className={`inline-flex items-center gap-2 rounded-[14px] bg-paper py-1.5 pr-3.5 pl-2 text-[13.5px] leading-snug font-medium text-text shadow-[inset_0_0_0_1px_var(--color-line)] ${className}`}>
      <span aria-hidden className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
        <Users className="h-[15px] w-[15px]" />
      </span>
      {customersLine(n, locale)}
    </p>
  )
}

/** Four facts about this product, one per line, each with a check in the brand's accent. */
export function Highlights({ items, className = '' }: { items: string[]; className?: string }) {
  const t = COPY[useLocale()]
  if (!items.length) return null
  return (
    <ul aria-label={t.highlights} className={`grid gap-2.5 ${className}`}>
      {items.slice(0, 5).map((x) => (
        <li key={x} className="flex items-start gap-3 text-[15.5px] leading-[1.4] text-text">
          <span aria-hidden className="mt-px flex h-[21px] w-[21px] flex-none items-center justify-center rounded-full bg-cyan-50 text-cyan-700 shadow-[inset_0_0_0_1px_var(--color-cyan-100)]">
            <Check className="h-3 w-3" strokeWidth={2.6} />
          </span>
          {x}
        </li>
      ))}
    </ul>
  )
}

/** The price of the chosen configuration. Bundle savings are shown by BundleOffer, never as a reduced unit price. */
export function PriceBlock({ productId, variantId, purchasable }: { productId: ProductId; variantId?: string; purchasable: boolean }) {
  const ui = useUi()
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-[30px] leading-none font-medium tracking-[-0.025em] text-ink">
        <Price productId={productId} variantId={variantId} />
      </span>
      {purchasable && <span className="text-[14px] text-muted">{ui.vat}</span>}
    </p>
  )
}

/**
 * The store's bundle offers for this product, as quantity choices: 1, 2 (−10%), 3+ (−20%) for NEUROS Calm,
 * Focus; 1 or 3 pairs (2+1) for NEUROS Amber. Each row shows the total and the saving in lei for
 * that quantity of the chosen configuration, computed by the same engine as the cart and the server
 * (lib/promotions.ts) from the real price. Choosing a row sets the quantity the order buttons use.
 * The unit price never changes: the reduction is a bundle reduction, applied to the order.
 */
export function BundleOffer({
  productId,
  variantId,
  quantity,
  onQuantity,
  className = '',
  compact = false,
  onAmberGroup,
}: {
  productId: ProductId
  variantId?: string
  quantity: number
  onQuantity: (n: number) => void
  className?: string
  /** Smaller rows, for the add-to-cart confirmation and the checkout summary. */
  compact?: boolean
  /**
   * NEUROS Amber: choosing the 2+1 row opens the frames configurator (any mix of frames) instead of setting the
   * quantity of one frame. Called with the number of pairs that row stands for; default: the product page's picker.
   */
  onAmberGroup?: (pairs: number) => void
}) {
  const locale = useLocale()
  const t = COPY[locale]
  const { openAmber } = useOfferSheets()
  const money = useMoney()
  const p = promotionFor(productId)
  const product = getProduct(productId, locale)!
  const base = unitPrice(product, getVariant(product, variantId))
  if (!p || base === null) return null
  const unit = money.unit(base)

  const amber = p.kind === 'buy_x_get_y'
  const steps = amber ? [1, p.group] : [1, ...p.tiers.map((x) => x.minUnits)]
  const last = steps[steps.length - 1]
  const priced = (n: number) => priceLines([{ key: 'x', productId, quantity: n, unitAmount: unit }])

  return (
    <div className={className}>
      <p className={`${compact ? 'text-[14px]' : 'text-[15px]'} font-semibold text-ink`}>{amber ? t.amberHead : t.bundleHead}</p>
      <div role="radiogroup" aria-label={amber ? t.amberHead : t.bundleHead} className={`${compact ? 'mt-2 gap-1.5' : 'mt-2.5 gap-2'} grid`}>
        {steps.map((step) => {
          // The last row stands for "this many or more": it follows the stepper above it.
          const n = step === last && quantity > last ? quantity : step
          const on = quantity === n
          const r = priced(n)
          const tier = p.kind === 'bundle_percent' ? [...p.tiers].reverse().find((x) => n >= x.minUnits) : null
          const deal = amber ? n >= p.group : !!tier
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => (amber && n >= p.group ? (onAmberGroup ?? ((x: number) => openAmber('product_page', Math.min(3, x))))(n) : onQuantity(n))}
              className={`flex ${compact ? 'min-h-[48px] rounded-[12px] px-3 py-1.5' : 'min-h-[60px] rounded-[14px] px-3.5 py-2.5'} items-center gap-3 text-left transition-[box-shadow,background-color] duration-150 ${
                on ? 'bg-paper shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'bg-paper shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-ink)]'
              }`}
            >
              <span aria-hidden className={`flex h-5 w-5 flex-none items-center justify-center rounded-full ${on ? 'bg-ink' : 'shadow-[inset_0_0_0_1.5px_var(--color-faint)]'}`}>
                {on && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              <span className="min-w-0 flex-1 leading-snug">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[15.5px] font-semibold text-ink">{amber ? t.pairs(n) : t.pieces(n)}</span>
                  {deal && (
                    <span className="rounded-[6px] bg-red-dark px-1.5 py-0.5 text-[12px] leading-none font-semibold text-white tabular-nums">
                      {amber ? promoText(p.badge, locale) : `−${tier!.percent}%`}
                    </span>
                  )}
                </span>
                {deal && !compact && <span className="mt-0.5 block text-[13px] text-text">{amber ? t.amberLine : t.bundleLine(n, tier!.percent)}</span>}
              </span>
              <span className="flex-none text-right leading-snug">
                <span data-price className="block text-[15.5px] font-semibold text-ink tabular-nums">{money.fmt(r.totalMinor)}</span>
                {r.discountMinor > 0 && <span data-price className="block text-[12.5px] font-medium text-red-deep tabular-nums">{t.save(money.fmt(r.discountMinor))}</span>}
              </span>
            </button>
          )
        })}
      </div>
      {!compact && <p className="mt-2 text-[13px] leading-snug text-muted">
        {amber ? (
          <>
            {t.amberNote}{' '}
            <button type="button" onClick={() => openAmber('product_page', 3)} className="font-medium text-ink underline underline-offset-4 hover:text-cyan-700">
              {t.amberMix}
            </button>
          </>
        ) : (
          t.bundleNote
        )}
      </p>}
    </div>
  )
}

/** Availability. The store sells what has a price; it ships in the stated processing time. */
export function Availability({ className = '', productId }: { className?: string; productId?: ProductId }) {
  const t = COPY[useLocale()]
  if (productId && getProduct(productId)?.soldOut)
    return (
      <p className={`flex items-center gap-2.5 text-[14.5px] leading-snug text-text ${className}`}>
        <span aria-hidden className="h-2.5 w-2.5 flex-none rounded-full bg-red-deep" />
        <strong className="font-semibold text-ink">{t.soldOut}</strong>
      </p>
    )
  return (
    <p className={`flex items-center gap-2.5 text-[14.5px] leading-snug text-text ${className}`}>
      <span aria-hidden className="relative flex h-2.5 w-2.5 flex-none">
        <span className="absolute inset-0 rounded-full bg-[#1f9d55]/25" style={{ transform: 'scale(1.8)' }} />
        <span className="relative h-2.5 w-2.5 rounded-full bg-[#1f9d55]" />
      </span>
      <span className="flex flex-col leading-tight">
        <strong className="font-semibold text-ink">{t.inStock}</strong>
        <span className="mt-0.5 text-[13.5px] text-muted">{t.ships}</span>
      </span>
    </p>
  )
}

/**
 * Ordering with a person: the phone (tel:, the configured number) and WhatsApp with the product, the
 * chosen variant and quantity already written. Side by side at every width: each label is two short
 * lines ("Comandă" / "telefonic"), so nothing is cut or squeezed. One full-width phone button without WhatsApp.
 */
export function ContactOrder({ productId, variantId, quantity, className = '' }: { productId: ProductId; variantId?: string; quantity: number; className?: string }) {
  const locale = useLocale()
  const t = COPY[locale]
  const product = getProduct(productId, locale)!
  const variant = getVariant(product, variantId)
  const wa = site.whatsapp
  const btn = 'btn-secondary !min-h-[56px] w-full !justify-start !gap-3 !px-3.5 !py-2 text-left'
  const label = (second: string) => (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="text-[12.5px] font-normal text-muted">{t.order}</span>
      <span className="text-[15px] font-semibold text-ink">{second}</span>
    </span>
  )

  if (!wa) {
    return (
      <a href={site.phoneHref} className={`${btn} ${className}`}>
        <Phone className="!h-[19px] !w-[19px] flex-none text-cyan-700" aria-hidden />
        {label(t.phone)}
        <span className="ml-auto text-[14.5px] font-medium whitespace-nowrap text-muted tabular-nums">{site.phone}</span>
      </a>
    )
  }

  const waHref = `https://wa.me/${wa}?text=${encodeURIComponent(t.waMessage(product.name, variant ? variantLabel(product, variant) : null, quantity))}`
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${className}`}>
      <a href={site.phoneHref} aria-label={`${t.order} ${t.phone}, ${site.phone}`} className={btn}>
        <Phone className="!h-[19px] !w-[19px] flex-none text-cyan-700" aria-hidden />
        {label(t.phone)}
      </a>
      <a href={waHref} target="_blank" rel="noopener noreferrer" aria-label={`${t.order} ${t.whatsapp}${t.newTab}`} className={`${btn} hover:!shadow-[inset_0_0_0_1px_#128c7e]`}>
        <WhatsApp className="!h-[20px] !w-[20px] flex-none text-[#128c7e]" aria-hidden />
        {label(t.whatsapp)}
      </a>
    </div>
  )
}

type Icon = ComponentType<SVGProps<SVGSVGElement>>

/**
 * The four store promises, from the stated terms. One line icon each, the label under it. The book has its own: its
 * delivery is paid once per order, it has no warranty, and its PDF comes with it.
 */
export function TrustRow({ className = '', productId }: { className?: string; productId?: ProductId }) {
  const locale = useLocale()
  const t = COPY[locale]
  const ui = useUi()
  const book = !!productId && isBook(productId)
  const items: [Icon, string][] = [
    // English pages pay in euro or dollars, by card only.
    cashOnDelivery.enabled && locale === 'ro' ? [Wallet, t.payOnDelivery] : [Lock, t.securePay],
    book ? [Truck, t.bookDelivery] : [Truck, ui.freeDelivery],
    [Return, ui.returns],
    book ? [Check, t.pdfIncluded] : [ShieldCheck, ui.warranty],
  ]
  return (
    <ul aria-label={t.promises} className={`grid grid-cols-4 gap-x-2 ${className}`}>
      {items.map(([I, label]) => (
        <li key={label} className="flex flex-col items-center gap-2 text-center text-[13px] leading-tight text-text">
          <I className="h-[22px] w-[22px] text-cyan-700" aria-hidden />
          <span className="max-w-[9em] text-balance">{label}</span>
        </li>
      ))}
    </ul>
  )
}
