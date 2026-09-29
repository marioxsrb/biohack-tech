'use client'

import Image from 'next/image'
import Link from 'next/link'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { Arrow, Check, Lock } from '@/components/ui/icons'
import { getProduct, unitPrice, variantLabel, type ProductId } from '@/content/catalog'
import { terms } from '@/config/site'
import { AMBER_ID, amberLabel, amberModels, amberTotals, pairsToLines } from '@/lib/amber-pairs'
import { trackUi, type UiPlacement } from '@/lib/analytics'
import { formatLei } from '@/lib/money'
import type { EntrySource } from '@/lib/purchase'
import { Sheet } from './Sheet'

type Open = ({ kind: 'amber'; slots: number; placement: UiPlacement } | { kind: 'variant'; productId: ProductId; placement: UiPlacement }) & { n: number }

const Ctx = createContext<{
  openAmber: (placement: UiPlacement, slots?: number) => void
  openVariant: (productId: ProductId, placement: UiPlacement) => void
} | null>(null)

export const useOfferSheets = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useOfferSheets must be used inside <OfferSheetsProvider>')
  return c
}

/** Where a line added from a sheet came from (kept on the cart line; the order's acquisition is not touched). */
const sourceFor = (placement: UiPlacement, kind: 'amber' | 'variant'): EntrySource | undefined =>
  placement === 'cart' ? 'cart_cross_sell' : placement === 'checkout' ? 'checkout_cross_sell' : kind === 'amber' ? 'amber_configurator' : undefined

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
      openVariant: (productId: ProductId, placement: UiPlacement) => setOpen({ kind: 'variant', productId, placement, n: ++opened.current }),
    }),
    [],
  )
  return (
    <Ctx.Provider value={value}>
      {children}
      {open?.kind === 'amber' && <AmberPairs key={open.n} slots={open.slots} placement={open.placement} onClose={close} />}
      {open?.kind === 'variant' && <VariantPicker key={open.n} productId={open.productId} placement={open.placement} onClose={close} />}
    </Ctx.Provider>
  )
}

function AmberPairs({ slots, placement, onClose }: { slots: number; placement: UiPlacement; onClose: () => void }) {
  const { lines, addMany } = useCart()
  const models = useMemo(() => amberModels(), [])
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
  const p = getProduct(AMBER_ID)!
  const unit = p.price ?? 0

  const title = slots === 3 ? 'Alege 3 perechi. Plătești 2.' : slots === 1 ? 'Alege încă o pereche. Este gratuită.' : `Alege încă ${slots} perechi. Una este gratuită.`
  const cta = slots === 1 ? 'Adaugă perechea în coș' : `Adaugă cele ${slots} perechi în coș`

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
      <Sheet open onClose={onClose} label="Perechile au fost adăugate" title={<p className="text-[17px] font-semibold text-ink">NEUROS Amber 2+1</p>}>
        <div className="mx-auto max-w-[30em] py-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-700 text-white">
            <Check className="h-6 w-6" />
          </span>
          <p className="mt-4 text-[24px] leading-tight font-medium tracking-[-0.02em] text-ink" role="status">
            {slots === 1 ? 'Am adăugat perechea în coș.' : `Am adăugat cele ${slots} perechi în coș.`}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/cart" onClick={onClose} className="cta">
              Vezi coșul <Arrow />
            </Link>
            <button type="button" onClick={onClose} className="btn-secondary">
              Continuă cumpărăturile
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
          <p className="inline-flex rounded-full bg-[#f5b041] px-2.5 py-0.5 text-[12.5px] font-semibold text-ink">2+1 gratis</p>
          <h2 className="mt-1 text-[clamp(20px,2.4vw,26px)] leading-tight tracking-[-0.025em]">{title}</h2>
        </>
      }
      footer={
        <div className="space-y-3">
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[14.5px]">
            {inCart > 0 && (
              <>
                <dt className="text-muted">Deja în coș</dt>
                <dd className="text-right text-muted tabular-nums">{inCart === 1 ? '1 pereche' : `${inCart} perechi`}</dd>
              </>
            )}
            <dt className="text-muted">Subtotal NEUROS Amber</dt>
            <dd className="text-right tabular-nums">{formatLei(totals.subtotalMinor)}</dd>
            <dt className="font-medium text-ink">2+1</dt>
            <dd className="text-right font-medium text-ink tabular-nums">{totals.discountMinor ? `−${formatLei(totals.discountMinor)}` : '0 lei'}</dd>
            <dt className="pt-1 text-[16px] font-semibold text-ink">Total</dt>
            <dd className="pt-1 text-right text-[20px] font-medium tracking-[-0.02em] text-ink tabular-nums">{formatLei(totals.totalMinor)}</dd>
          </dl>
          <button type="button" onClick={add} disabled={!ready} className="cta w-full">
            <Lock /> {cta}
          </button>
          <p className="text-center text-[13px] text-muted" aria-live="polite">
            {ready ? `${terms.vat}. Închiderea ferestrei nu adaugă nimic.` : `Mai alege perechea ${slotNo(firstEmpty)}.`}
          </p>
        </div>
      }
    >
      <p className="text-[15px] text-text">{formatLei(unit)} perechea. Poți combina ramele sau alege aceeași ramă de mai multe ori. Lentilele chihlimbar sunt aceleași.</p>
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
                  <p className="text-[16px] font-semibold text-ink">Perechea {slotNo(i)}</p>
                  <p className={`truncate text-[14.5px] ${pick ? 'font-medium text-cyan-700' : 'text-muted'}`}>{pick ? amberLabel(pick) : 'Alege rama și culoarea'}</p>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                <div role="radiogroup" aria-label={`Rama, perechea ${slotNo(i)}`} className="grid grid-cols-2 gap-2">
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
                <div role="radiogroup" aria-label={`Culoarea, perechea ${slotNo(i)}`} className="flex flex-wrap gap-2">
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
                  {!activeModel && <p className="text-[14px] text-muted">Alege întâi rama.</p>}
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
  const p = getProduct(productId)!
  const [variantId, setVariantId] = useState<string | null>(null)
  const v = p.variants?.find((x) => x.id === variantId)
  const price = v ? unitPrice(p, v) : null
  return (
    <Sheet
      open
      onClose={onClose}
      label={`Alege configurația ${p.name}`}
      title={<h2 className="text-[clamp(20px,2.4vw,26px)] leading-tight tracking-[-0.025em]">{p.name}: alege configurația</h2>}
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
          {v ? `Adaugă în coș · ${formatLei(price ?? 0)}` : 'Alege o configurație'}
        </button>
      }
    >
      <div role="radiogroup" aria-label="Configurație" className="grid gap-3 sm:grid-cols-3">
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
      <p className="mt-4 text-[14.5px] text-text">Casca e aceeași; diferă câte zone poți activa. Protocolul îl stabilești cu un specialist la consultația de început.</p>
    </Sheet>
  )
}
