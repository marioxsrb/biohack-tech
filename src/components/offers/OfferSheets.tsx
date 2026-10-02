'use client'

import Image from 'next/image'
import Link from '@/components/ui/Link'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { Arrow, Check, Lock } from '@/components/ui/icons'
import { getProduct, unitPrice, variantLabel, type ProductId } from '@/content/catalog'
import { useLocale, useUi } from '@/i18n/LocaleProvider'
import type { Locale } from '@/i18n/locales'
import { AMBER_ID, amberLabel, amberModels, amberTotals, pairsToLines } from '@/lib/amber-pairs'
import { BUNDLE, bundleNeeds, bundleToLines, bundleTotals, pickComplete, type BundlePick } from '@/lib/bundle-picks'
import { trackUi, type UiPlacement } from '@/lib/analytics'
import { formatLei } from '@/lib/money'
import type { EntrySource } from '@/lib/purchase'
import { Sheet } from './Sheet'

const COPY = {
  ro: {
    amberTitle: (slots: number) => (slots === 3 ? 'Alege 3 perechi. Plătești 2.' : slots === 1 ? 'Alege încă o pereche. Este gratuită.' : `Alege încă ${slots} perechi. Una este gratuită.`),
    amberCta: (slots: number) => (slots === 1 ? 'Adaugă perechea în coș' : `Adaugă cele ${slots} perechi în coș`),
    pairsAddedLabel: 'Perechile au fost adăugate',
    pairsAdded: (slots: number) => (slots === 1 ? 'Am adăugat perechea în coș.' : `Am adăugat cele ${slots} perechi în coș.`),
    amberBadge: '2+1 gratis',
    amberShort: '2+1',
    inCart: 'Deja în coș',
    pairs: (n: number) => (n === 1 ? '1 pereche' : `${n} perechi`),
    amberSubtotal: 'Subtotal NEUROS Amber',
    pickPair: (n: number) => `Mai alege perechea ${n}.`,
    amberIntro: (price: string) => `${price} perechea. Poți combina ramele sau alege aceeași ramă de mai multe ori. Lentilele chihlimbar sunt aceleași.`,
    pair: (n: number) => `Perechea ${n}`,
    chooseFrame: 'Alege rama și culoarea',
    frameOf: (n: number) => `Rama, perechea ${n}`,
    colourOf: (n: number) => `Culoarea, perechea ${n}`,
    frameFirst: 'Alege întâi rama.',
    variantLabel: (name: string) => `Alege configurația ${name}`,
    variantTitle: (name: string) => `${name}: alege configurația`,
    chooseVariant: 'Alege o configurație',
    configuration: 'Configurație',
    variantNote: 'Casca e aceeași. Diferă câte zone poți activa. Protocolul îl stabilești cu un specialist la consultația de început.',
    bundleName: '20% la 3 produse',
    bundleAdded: 'Am adăugat selecția în coș. Reducerea de 20% se aplică.',
    bundleActive: 'Reducerea de 20% este deja activă în coș.',
    backToOrder: 'Înapoi la comandă',
    bundleTitle: (missing: number) => (missing === 3 ? 'Alege 3 produse. Primești 20% reducere.' : missing === 1 ? 'Mai alege 1 produs pentru 20% reducere.' : `Mai alege ${missing} produse pentru 20% reducere.`),
    products: (n: number) => (n === 1 ? '1 produs' : `${n} produse`),
    discount: (p: number) => `Reducere ${p}%`,
    totalAfter: 'Total după reducere',
    addSelection: 'Adaugă selecția în coș',
    pickConfigFor: (n: number) => `Alege configurația pentru produsul ${n}.`,
    pickProduct: (n: number) => `Mai alege produsul ${n}.`,
    bundleIntro: 'NEUROS Calm, NEUROS Focus și NEUROS Flow, în orice combinație. Poți alege același produs de mai multe ori.',
    product: (n: number) => `Produsul ${n}`,
    chooseProduct: 'Alege produsul',
    flowConfigOf: (n: number) => `Configurația NEUROS Flow, produsul ${n}`,
  },
  en: {
    amberTitle: (slots: number) => (slots === 3 ? 'Choose 3 pairs. Pay for 2.' : slots === 1 ? 'Choose one more pair. It is free.' : `Choose ${slots} more pairs. One of them is free.`),
    amberCta: (slots: number) => (slots === 1 ? 'Add the pair to your cart' : `Add the ${slots} pairs to your cart`),
    pairsAddedLabel: 'Pairs added',
    pairsAdded: (slots: number) => (slots === 1 ? 'We added the pair to your cart.' : `We added the ${slots} pairs to your cart.`),
    amberBadge: '3 for 2',
    amberShort: '3 for 2',
    inCart: 'Already in your cart',
    pairs: (n: number) => (n === 1 ? '1 pair' : `${n} pairs`),
    amberSubtotal: 'NEUROS Amber subtotal',
    pickPair: (n: number) => `Choose pair ${n}.`,
    amberIntro: (price: string) => `${price} per pair. You can mix the frames or pick the same frame more than once. The amber lenses are the same in every frame.`,
    pair: (n: number) => `Pair ${n}`,
    chooseFrame: 'Choose the frame and colour',
    frameOf: (n: number) => `Frame, pair ${n}`,
    colourOf: (n: number) => `Colour, pair ${n}`,
    frameFirst: 'Choose the frame first.',
    variantLabel: (name: string) => `Choose the ${name} configuration`,
    variantTitle: (name: string) => `${name}: choose the configuration`,
    chooseVariant: 'Choose a configuration',
    configuration: 'Configuration',
    variantNote: 'The headset is the same. The configurations differ in how many zones you can switch on. You set the protocol with a specialist at your first consultation.',
    bundleName: '20% off 3 products',
    bundleAdded: 'We added your selection to the cart. The 20% discount applies.',
    bundleActive: 'The 20% discount is already applied in your cart.',
    backToOrder: 'Back to your order',
    bundleTitle: (missing: number) => (missing === 3 ? 'Choose 3 products. Get 20% off.' : missing === 1 ? 'Add 1 more product for 20% off.' : `Add ${missing} more products for 20% off.`),
    products: (n: number) => (n === 1 ? '1 product' : `${n} products`),
    discount: (p: number) => `${p}% discount`,
    totalAfter: 'Total after discount',
    addSelection: 'Add your selection to the cart',
    pickConfigFor: (n: number) => `Choose the configuration for product ${n}.`,
    pickProduct: (n: number) => `Choose product ${n}.`,
    bundleIntro: 'NEUROS Calm, NEUROS Focus and NEUROS Flow, in any mix. You can choose the same product more than once.',
    product: (n: number) => `Product ${n}`,
    chooseProduct: 'Choose the product',
    flowConfigOf: (n: number) => `NEUROS Flow configuration, product ${n}`,
  },
}

type Open = ({ kind: 'amber'; slots: number; placement: UiPlacement } | { kind: 'bundle'; placement: UiPlacement } | { kind: 'variant'; productId: ProductId; placement: UiPlacement }) & { n: number }

const Ctx = createContext<{
  openAmber: (placement: UiPlacement, slots?: number) => void
  /** The 20% for 3 products picker; asks only for the products the cart still needs. */
  openBundle: (placement: UiPlacement) => void
  openVariant: (productId: ProductId, placement: UiPlacement) => void
} | null>(null)

export const useOfferSheets = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useOfferSheets must be used inside <OfferSheetsProvider>')
  return c
}

/** Where a line added from a sheet came from (kept on the cart line; the order's acquisition is not touched). */
const sourceFor = (placement: UiPlacement, kind: 'amber' | 'bundle' | 'variant'): EntrySource | undefined =>
  placement === 'cart' ? 'cart_cross_sell' : placement === 'checkout' ? 'checkout_cross_sell' : kind === 'amber' ? 'amber_configurator' : kind === 'bundle' ? 'bundle_configurator' : undefined

/**
 * One place that opens the purchase pickers from anywhere (homepage, product page, cart, checkout):
 * the NEUROS Amber 2+1 pairs and the NEUROS Flow configuration. Nothing is added until the customer
 * presses the add button; closing adds nothing.
 */
export function OfferSheetsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null)
  const close = useCallback(() => setOpen(null), [])
  // Every opening is a fresh picker (no state carried over from the last one).
  const opened = useRef(0)
  const value = useMemo(
    () => ({
      openAmber: (placement: UiPlacement, slots = 3) => {
        setOpen({ kind: 'amber', slots: Math.min(3, Math.max(1, slots)), placement, n: ++opened.current })
        trackUi('open_amber_bundle_configurator', {
          placement,
          product_id: AMBER_ID,
          items: slots,
        })
      },
      openBundle: (placement: UiPlacement) => {
        setOpen({ kind: 'bundle', placement, n: ++opened.current })
        trackUi('open_bundle_configurator', { placement })
      },
      openVariant: (productId: ProductId, placement: UiPlacement) => setOpen({ kind: 'variant', productId, placement, n: ++opened.current }),
    }),
    [],
  )
  return (
    <Ctx.Provider value={value}>
      {children}
      {open?.kind === 'amber' && <AmberPairs key={open.n} slots={open.slots} placement={open.placement} onClose={close} />}
      {open?.kind === 'bundle' && <BundlePicker key={open.n} placement={open.placement} onClose={close} />}
      {open?.kind === 'variant' && <VariantPicker key={open.n} productId={open.productId} placement={open.placement} onClose={close} />}
    </Ctx.Provider>
  )
}

function AmberPairs({ slots, placement, onClose }: { slots: number; placement: UiPlacement; onClose: () => void }) {
  const { lines, addMany } = useCart()
  const locale = useLocale()
  const t = COPY[locale]
  const ui = useUi()
  const models = useMemo(() => amberModels(locale), [locale])
  const [picks, setPicks] = useState<(string | null)[]>(() => Array.from({ length: slots }, () => null))
  const [done, setDone] = useState(false)
  // A model chosen before its colour (the pair is complete only with both).
  const [modelDraft, setModelDraft] = useState<Record<number, string>>({})
  const existing = lines.filter((l) => l.product.id === AMBER_ID).map((l) => ({ variantId: l.variant?.id, quantity: l.quantity }))
  const inCart = existing.reduce((n, l) => n + l.quantity, 0)
  const totals = amberTotals(existing, picks)
  const ready = pairsToLines(picks)
  const firstEmpty = picks.findIndex((p) => !p)
  // Pairs are numbered after the ones already in the cart when completing a 2+1.
  const slotNo = (i: number) => (slots === 3 ? i + 1 : inCart + i + 1)
  const p = getProduct(AMBER_ID, locale)!
  const unit = p.price ?? 0

  const title = t.amberTitle(slots)
  const cta = t.amberCta(slots)

  const modelOf = (variantId: string | null) => (variantId ? models.find((m) => m.colours.some((c) => c.variantId === variantId)) : undefined)
  const chooseModel = (i: number, id: string) => {
    const m = models.find((x) => x.id === id)!
    const current = modelOf(picks[i])
    const colour = current?.colours.find((c) => c.variantId === picks[i])?.id
    const keep = m.colours.find((c) => c.id === colour)
    setPicks((ps) => ps.map((x, j) => (j === i ? (keep ? keep.variantId : m.colours.length === 1 ? m.colours[0].variantId : null) : x)))
    setModelDraft((d) => ({ ...d, [i]: id }))
  }

  const add = () => {
    if (!ready || !addMany(ready, sourceFor(placement, 'amber'))) return
    trackUi('complete_amber_bundle_configurator', {
      placement,
      product_id: AMBER_ID,
      items: slots,
    })
    if (placement === 'cart' || placement === 'checkout') onClose()
    else setDone(true)
  }

  if (done) {
    return (
      <Sheet open onClose={onClose} label={t.pairsAddedLabel} title={<p className="text-[17px] font-semibold text-ink">NEUROS Amber 2+1</p>}>
        <div className="mx-auto max-w-[30em] py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-700 text-white">
            <Check className="h-6 w-6" />
          </span>
          <p className="mt-4 text-[24px] leading-tight font-medium tracking-[-0.02em] text-ink" role="status">
            {t.pairsAdded(slots)}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/cart" onClick={onClose} className="cta">
              {ui.viewCart} <Arrow />
            </Link>
            <button type="button" onClick={onClose} className="btn-secondary">
              {ui.keepShopping}
            </button>
          </div>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      open
      onClose={onClose}
      label={title}
      title={
        <>
          <p className="inline-flex rounded-full bg-[#f5b041] px-2.5 py-0.5 text-[12.5px] font-semibold text-ink">{t.amberBadge}</p>
          <h2 className="mt-1 text-[clamp(20px,2.4vw,26px)] leading-tight tracking-[-0.025em]">{title}</h2>
        </>
      }
      footer={
        <div className="space-y-3">
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[14.5px]">
            {inCart > 0 && (
              <>
                <dt className="text-muted">{t.inCart}</dt>
                <dd className="text-right text-muted tabular-nums">{t.pairs(inCart)}</dd>
              </>
            )}
            <dt className="text-muted">{t.amberSubtotal}</dt>
            <dd className="text-right tabular-nums">{formatLei(totals.subtotalMinor)}</dd>
            <dt className="font-medium text-ink">{t.amberShort}</dt>
            <dd className="text-right font-medium text-ink tabular-nums">{totals.discountMinor ? `−${formatLei(totals.discountMinor)}` : '0 lei'}</dd>
            <dt className="pt-1 text-[16px] font-semibold text-ink">Total</dt>
            <dd className="pt-1 text-right text-[20px] font-medium tracking-[-0.02em] text-ink tabular-nums">{formatLei(totals.totalMinor)}</dd>
          </dl>
          <button type="button" onClick={add} disabled={!ready} className="cta w-full">
            <Lock /> {cta}
          </button>
          <p className="text-center text-[13px] text-muted" aria-live="polite">
            {ready ? `${ui.vat}.` : t.pickPair(slotNo(firstEmpty))}
          </p>
        </div>
      }
    >
      <p className="text-[15px] text-text">{t.amberIntro(formatLei(unit))}</p>
      <ol className="mt-4 space-y-3">
        {picks.map((pick, i) => {
          const activeModel = models.find((m) => m.id === (modelDraft[i] ?? modelOf(pick)?.id))
          const img = pick ? p.variants?.find((v) => v.id === pick)?.images.find((x) => x.kind === 'cutout') : undefined
          return (
            <li key={i} className={`rounded-[18px] bg-paper p-4 transition-shadow sm:p-5 ${pick ? 'shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)]'}`}>
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-20 flex-none rounded-[10px] bg-mist sm:h-16 sm:w-24">
                  {img && <Image src={img.src} alt={img.alt} fill sizes="96px" className="object-contain p-[8%]" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[16px] font-semibold text-ink">{t.pair(slotNo(i))}</p>
                  <p className={`truncate text-[14.5px] ${pick ? 'font-medium text-cyan-700' : 'text-muted'}`}>{pick ? amberLabel(pick, locale) : t.chooseFrame}</p>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                <div role="radiogroup" aria-label={t.frameOf(slotNo(i))} className="grid grid-cols-2 gap-2">
                  {models.map((m) => {
                    const on = activeModel?.id === m.id
                    const thumb = p.variants?.find((v) => v.id === m.colours[0].variantId)?.images.find((x) => x.kind === 'cutout')
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => chooseModel(i, m.id)}
                        className={`flex min-h-14 items-center gap-2 rounded-[12px] px-2.5 py-2 text-left text-[14.5px] font-medium transition-shadow ${on ? 'bg-mist shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-ink)]'}`}
                      >
                        {thumb && (
                          <span className="relative h-8 w-12 flex-none">
                            <Image src={thumb.src} alt="" fill sizes="48px" className="object-contain" />
                          </span>
                        )}
                        {m.label}
                      </button>
                    )
                  })}
                </div>
                <div role="radiogroup" aria-label={t.colourOf(slotNo(i))} className="flex flex-wrap gap-2">
                  {(activeModel?.colours ?? []).map((c) => {
                    const on = pick === c.variantId
                    return (
                      <button
                        key={c.variantId}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPicks((ps) => ps.map((x, j) => (j === i ? c.variantId : x)))}
                        className={`flex min-h-11 items-center gap-2 rounded-full py-1.5 pr-4 pl-2.5 text-[14.5px] font-medium transition-colors ${on ? 'bg-ink text-white' : 'bg-paper text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-ink)]'}`}
                      >
                        {c.swatch && <span aria-hidden className="h-5 w-5 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.18)]" style={{ background: c.swatch }} />}
                        {c.label}
                        {on && <Check className="h-4 w-4" aria-hidden />}
                      </button>
                    )
                  })}
                  {!activeModel && <p className="text-[14px] text-muted">{t.frameFirst}</p>}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </Sheet>
  )
}

/** A product with configurations (NEUROS Flow): choose one, then add. */
function VariantPicker({ productId, placement, onClose }: { productId: ProductId; placement: UiPlacement; onClose: () => void }) {
  const { add } = useCart()
  const locale = useLocale()
  const t = COPY[locale]
  const ui = useUi()
  const p = getProduct(productId, locale)!
  const [variantId, setVariantId] = useState<string | null>(null)
  const v = p.variants?.find((x) => x.id === variantId)
  const price = v ? unitPrice(p, v) : null
  return (
    <Sheet
      open
      onClose={onClose}
      label={t.variantLabel(p.name)}
      title={<h2 className="text-[clamp(20px,2.4vw,26px)] leading-tight tracking-[-0.025em]">{t.variantTitle(p.name)}</h2>}
      footer={
        <button
          type="button"
          disabled={!v}
          onClick={() => {
            if (v && add(p.id, v.id, 1, sourceFor(placement, 'variant'))) {
              trackUi('add_cross_sell', {
                placement,
                product_id: p.id,
                variant_id: v.id,
              })
              onClose()
            }
          }}
          className="cta w-full"
        >
          {v ? `${ui.addToCart} · ${formatLei(price ?? 0)}` : t.chooseVariant}
        </button>
      }
    >
      <div role="radiogroup" aria-label={t.configuration} className="grid gap-3 sm:grid-cols-3">
        {(p.variants ?? []).map((x) => {
          const on = x.id === variantId
          const xp = unitPrice(p, x)
          return (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setVariantId(x.id)}
              className={`flex flex-col items-start rounded-[16px] bg-paper p-4 text-left transition-shadow ${on ? 'shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)]'}`}
            >
              <span className="text-[17px] font-semibold text-ink">{variantLabel(p, x)}</span>
              <span className="mt-2 text-[18px] font-medium tabular-nums">{xp !== null ? formatLei(xp) : ''}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-4 text-[14.5px] text-text">{t.variantNote}</p>
    </Sheet>
  )
}

/**
 * 20% for 3 products: one slot per product the cart still needs (3, 2 or 1). Each slot is a product
 * (NEUROS Calm, NEUROS Focus, NEUROS Flow; the same product more than once is fine) and, for NEUROS Flow,
 * its configuration. Totals from the promotion engine; one button adds everything; closing adds nothing.
 */
function BundlePicker({ placement, onClose }: { placement: UiPlacement; onClose: () => void }) {
  const { lines, addMany } = useCart()
  const locale = useLocale()
  const t = COPY[locale]
  const ui = useUi()
  const cart = lines.map((l) => ({ productId: l.product.id, variantId: l.variant?.id, quantity: l.quantity }))
  // The number of slots is fixed when the picker opens.
  const [need] = useState(() => bundleNeeds(cart))
  const [picks, setPicks] = useState<BundlePick[]>(() => Array.from({ length: need.missing }, () => ({ productId: null, variantId: null })))
  const [done, setDone] = useState(false)
  const totals = bundleTotals(cart, picks)
  const ready = bundleToLines(picks)
  const firstOpen = picks.findIndex((p) => !pickComplete(p))
  const slotNo = (i: number) => need.units + i + 1
  const set = (i: number, next: BundlePick) => setPicks((ps) => ps.map((p, j) => (j === i ? next : p)))

  if (need.missing === 0 || done) {
    return (
      <Sheet open onClose={onClose} label={t.bundleName} title={<p className="text-[17px] font-semibold text-ink">{t.bundleName}</p>}>
        <div className="mx-auto max-w-[30em] py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-700 text-white">
            <Check className="h-6 w-6" />
          </span>
          <p className="mt-4 text-[22px] leading-tight font-medium tracking-[-0.02em] text-ink" role="status">
            {done ? t.bundleAdded : t.bundleActive}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {placement !== 'cart' && placement !== 'checkout' && (
              <Link href="/cart" onClick={onClose} className="cta">
                {ui.viewCart} <Arrow />
              </Link>
            )}
            <button type="button" onClick={onClose} className="btn-secondary">
              {placement === 'cart' || placement === 'checkout' ? t.backToOrder : ui.keepShopping}
            </button>
          </div>
        </div>
      </Sheet>
    )
  }

  const title = t.bundleTitle(need.missing)
  const add = () => {
    if (!ready || !addMany(ready, sourceFor(placement, 'bundle'))) return
    trackUi('complete_bundle_configurator', { placement, items: need.missing })
    if (placement === 'cart' || placement === 'checkout') onClose()
    else setDone(true)
  }

  return (
    <Sheet
      open
      onClose={onClose}
      label={title}
      title={
        <>
          <p className="inline-flex rounded-full bg-cyan-700 px-2.5 py-0.5 text-[12.5px] font-semibold text-white">{t.bundleName}</p>
          <h2 className="mt-1 text-[clamp(20px,2.4vw,26px)] leading-tight tracking-[-0.025em]">{title}</h2>
        </>
      }
      footer={
        <div className="space-y-3">
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[14.5px]">
            {picks.map((p, i) =>
              pickComplete(p) ? (
                <div key={i} className="contents">
                  <dt className="truncate text-text">{pickLabel(p, locale)}</dt>
                  <dd className="text-right tabular-nums">{formatLei(unitPrice(getProduct(p.productId!)!, getProduct(p.productId!)!.variants?.find((v) => v.id === p.variantId)) ?? 0)}</dd>
                </div>
              ) : null,
            )}
            {need.units > 0 && (
              <>
                <dt className="text-muted">{t.inCart}</dt>
                <dd className="text-right text-muted">{t.products(need.units)}</dd>
              </>
            )}
            <dt className="text-muted">Subtotal</dt>
            <dd className="text-right tabular-nums">{formatLei(totals.subtotalMinor)}</dd>
            <dt className="font-medium text-ink">{t.discount(totals.percent)}</dt>
            <dd className="text-right font-medium text-ink tabular-nums">{totals.discountMinor ? `−${formatLei(totals.discountMinor)}` : '0 lei'}</dd>
            <dt className="pt-1 text-[16px] font-semibold text-ink">{t.totalAfter}</dt>
            <dd className="pt-1 text-right text-[20px] font-medium tracking-[-0.02em] text-ink tabular-nums">{formatLei(totals.totalMinor)}</dd>
          </dl>
          <button type="button" onClick={add} disabled={!ready} className="cta w-full">
            <Lock /> {t.addSelection}
          </button>
          <p className="text-center text-[13px] text-muted" aria-live="polite">
            {ready ? ui.vat + '.' : picks[firstOpen]?.productId === 'brain-flow' ? t.pickConfigFor(slotNo(firstOpen)) : t.pickProduct(slotNo(firstOpen))}
          </p>
        </div>
      }
    >
      <p className="text-[15px] text-text">{t.bundleIntro}</p>
      <ol className="mt-4 space-y-3">
        {picks.map((pick, i) => {
          const flow = pick.productId ? getProduct(pick.productId, locale) : undefined
          return (
            <li key={i} className={`rounded-[18px] bg-paper p-4 transition-shadow sm:p-5 ${pickComplete(pick) ? 'shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)]'}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[16px] font-semibold text-ink">{t.product(slotNo(i))}</p>
                <p className={`truncate text-[14.5px] ${pickComplete(pick) ? 'font-medium text-cyan-700' : 'text-muted'}`}>{pickComplete(pick) ? pickLabel(pick, locale) : t.chooseProduct}</p>
              </div>
              <div role="radiogroup" aria-label={t.product(slotNo(i))} className="mt-3 grid grid-cols-3 gap-2">
                {(BUNDLE.products as ProductId[]).map((id) => {
                  const p = getProduct(id, locale)!
                  const on = pick.productId === id
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set(i, { productId: id, variantId: on ? pick.variantId : null })}
                      className={`flex flex-col items-center rounded-[14px] px-1.5 pt-2 pb-2.5 text-center transition-shadow ${on ? 'bg-mist shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-ink)]'}`}
                    >
                      <span className="relative block h-12 w-full sm:h-16">
                        <Image src={p.cutout.src} alt="" fill sizes="120px" className="object-contain" />
                      </span>
                      <span className="mt-1.5 text-[13.5px] leading-tight font-semibold text-ink">{p.name.replace('NEUROS ', '')}</span>
                      <span className="text-[12.5px] text-muted tabular-nums">
                        {p.variablePrice ? ui.from : ''}
                        {formatLei(p.price ?? 0)}
                      </span>
                    </button>
                  )
                })}
              </div>
              {flow?.variants?.length ? (
                <div role="radiogroup" aria-label={t.flowConfigOf(slotNo(i))} className="mt-3 grid grid-cols-3 gap-2">
                  {flow.variants.map((v) => {
                    const on = pick.variantId === v.id
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => set(i, { productId: flow.id, variantId: v.id })}
                        className={`flex min-h-14 flex-col items-center justify-center rounded-[12px] px-1 py-2 text-center transition-colors ${on ? 'bg-ink text-white' : 'bg-paper text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-ink)]'}`}
                      >
                        <span className="text-[14.5px] font-semibold">{variantLabel(flow, v)}</span>
                        <span className={`text-[12.5px] tabular-nums ${on ? 'text-white/80' : 'text-muted'}`}>{formatLei(unitPrice(flow, v) ?? 0)}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </Sheet>
  )
}

function pickLabel(p: BundlePick, locale: Locale) {
  const product = getProduct(p.productId!, locale)!
  const v = product.variants?.find((x) => x.id === p.variantId)
  return v ? `${product.name} · ${variantLabel(product, v)}` : product.name
}
