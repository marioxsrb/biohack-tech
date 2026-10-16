'use client'

import { cashOnDelivery } from '@/config/payments'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Arrow, Check, Close, Lock, Minus, Plus } from '@/components/ui/icons'
import { getProduct, unitPrice, variantLabel, type ProductId } from '@/content/catalog'
import { terms } from '@/config/site'
import { itemOf, track } from '@/lib/analytics'
import type { LandingSlug } from '@/lib/landing-hosts'
import { formatLei } from '@/lib/money'
import { priceLines, promotionProgress } from '@/lib/promotions'
import { amberCopy } from '@/lib/offer-copy'
import { MAX_QTY } from '@/lib/purchase'
import { checkoutHref, isPlainClick, startCheckout } from './checkout-link'

const KEY = 'bt-amber-selection'
type Selection = Record<string, number>

/** The customer's set in progress survives a reload of the landing (this tab only; a convenience). */
function readSelection(valid: string[]): Selection {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(Object.entries(raw).filter(([id, q]) => valid.includes(id) && Number.isInteger(q) && (q as number) > 0).map(([id, q]) => [id, Math.min(MAX_QTY, q as number)]))
  } catch {
    return {}
  }
}

/**
 * NEUROS Amber mix and match: every frame visible with its own photo, name and price; the customer
 * builds a set (any frames, any quantities), sees the 2+1 progress and the total computed by the
 * promotion engine, and continues with the whole selection. One pair or two are fine too: the offer is
 * an incentive, not a condition. Each frame stays its own cart and order line.
 */
export function AmberSelector({ slug, productId }: { slug: LandingSlug; productId: ProductId }) {
  const product = getProduct(productId)!
  const variants = useMemo(() => (product.variants ?? []).filter((v) => unitPrice(product, v) !== null), [product])
  const [sel, setSel] = useState<Selection>({})
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const summaryRef = useRef<HTMLDivElement>(null)
  const [summaryVisible, setSummaryVisible] = useState(true)
  const [inSection, setInSection] = useState(false)

  useEffect(() => {
    // ViewContent, like the other landings (LandingOffer). One per visit; consent-aware.
    if (product.price != null) track('view_item', { value: product.price, items: [itemOf(product)] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Restored after hydration so the server and the first client render agree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSel(readSelection(variants.map((v) => v.id)))
    setReady(true)
  }, [variants])
  useEffect(() => {
    if (!ready) return
    try {
      sessionStorage.setItem(KEY, JSON.stringify(sel))
    } catch {}
  }, [sel, ready])

  // Phones: a slim bar with the running total while the frames are on screen but the summary is not.
  useEffect(() => {
    const section = document.getElementById('comanda')
    const summary = summaryRef.current
    if (!section || !summary) return
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === section) setInSection(e.isIntersecting)
        if (e.target === summary) setSummaryVisible(e.isIntersecting)
      }
    })
    io.observe(section)
    io.observe(summary)
    return () => io.disconnect()
  }, [])

  const lines = variants.filter((v) => sel[v.id]).map((v) => ({ variant: v, quantity: sel[v.id], unit: unitPrice(product, v)! }))
  const priced = lines.map((l) => ({ key: l.variant.id, productId: product.id, quantity: l.quantity, unitAmount: l.unit }))
  const pricing = priceLines(priced)
  const progress = promotionProgress(priced).find((p) => p.kind === 'buy_x_get_y')
  const units = lines.reduce((n, l) => n + l.quantity, 0)
  const picks = lines.map((l) => ({ productId: product.id, variantId: l.variant.id, quantity: l.quantity }))

  const change = (id: string, next: number) => {
    const q = Math.max(0, Math.min(MAX_QTY, next))
    setSel((s) => {
      const out = { ...s }
      if (q) out[id] = q
      else delete out[id]
      return out
    })
    if (next > (sel[id] ?? 0)) {
      const v = variants.find((x) => x.id === id)!
      track('select_variant', { value: unitPrice(product, v) ?? 0, items: [itemOf(product, v, variantLabel(product, v))] })
    }
  }

  const go = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!picks.length) return e.preventDefault()
    if (!isPlainClick(e)) return
    e.preventDefault()
    startCheckout(router.push, slug, picks, { exact: true })
  }

  // Same wording as the cart and checkout, at every quantity (lib/offer-copy.ts).
  const c = amberCopy(progress ?? null)
  const status =
    units === 0
      ? { big: 'Alege prima pereche.', small: 'La 3 perechi, una este gratuită. Combină ramele cum vrei.' }
      : c.tone === 'active'
        ? { big: c.headline, small: [`Plătești ${formatLei(pricing.totalMinor)} în loc de ${formatLei(pricing.subtotalMinor)}.`, c.nudge ?? c.quiet].filter(Boolean).join(' ') }
        : { big: c.headline, small: '' }
  const active = !!progress?.active
  const steps = [0, 1, 2].map((i) => i < (units % 3 === 0 && units > 0 ? 3 : units % 3))

  const cta = (
    <a
      href={picks.length ? checkoutHref(slug, picks) : '#comanda'}
      onClick={go}
      aria-disabled={!picks.length}
      className={`cta w-full ${picks.length ? '' : 'pointer-events-none opacity-50'}`}
    >
      <Lock /> Continuă cu selecția <Arrow />
    </a>
  )

  return (
    <section id="comanda" aria-labelledby="alege-title" className="lp-wrap scroll-mt-20 py-[var(--sec)]">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div>
          <p className="inline-flex items-center rounded-full bg-[#f5b041] px-3 py-1 text-[13px] font-semibold text-ink">2+1 gratis</p>
          <h2 id="alege-title" className="mt-4 text-[clamp(34px,4vw,56px)] leading-[1] tracking-[-0.045em] text-[var(--lp-ink)]">
            Alege 3 perechi. Plătești 2.
          </h2>
        </div>
        <p className="max-w-[26em] text-[17px] leading-relaxed text-[var(--lp-muted)]">
          Combină ramele cum vrei: una pentru birou, una pentru seară. Toate au aceleași lentile chihlimbar. O pereche costă {formatLei(unitPrice(product, variants[0]) ?? 0)}.
        </p>
      </div>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-12">
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-8">
          {variants.map((v) => {
            const q = sel[v.id] ?? 0
            const img = v.images.find((i) => i.kind === 'cutout') ?? product.cutout
            const label = variantLabel(product, v)
            return (
              <li key={v.id} className={`flex flex-col rounded-[20px] bg-paper p-3 transition-shadow duration-200 sm:p-4 ${q ? 'shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'hover:shadow-[inset_0_0_0_1px_var(--lp-line)]'}`}>
                <div className="relative aspect-[16/10] rounded-[14px] bg-[var(--lp-bg)]">
                  <Image src={img.src} alt={img.alt} fill sizes="(min-width: 1024px) 360px, 45vw" className="object-contain p-[10%]" />
                  {q > 0 && (
                    <span className="absolute top-2 right-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-ink px-2 text-[13px] font-semibold text-white tabular-nums" aria-hidden>
                      ×{q}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[16px] leading-snug font-medium text-ink sm:text-[17px]">{label}</p>
                <p className="text-[15px] text-[var(--lp-muted)] tabular-nums">{formatLei(unitPrice(product, v) ?? 0)}</p>
                <div className="mt-3">
                  {q === 0 ? (
                    <button type="button" onClick={() => change(v.id, 1)} className="btn-secondary sm w-full" aria-label={`Adaugă ${label}`}>
                      <Plus /> Adaugă
                    </button>
                  ) : (
                    <div role="group" aria-label={`Câte perechi ${label}`} className="flex h-10 items-center justify-between rounded-[10px] bg-[var(--lp-bg)]">
                      <button type="button" onClick={() => change(v.id, q - 1)} aria-label={`O pereche mai puțin, ${label}`} className="flex h-10 w-11 items-center justify-center text-ink">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-[15px] font-semibold text-ink tabular-nums" aria-live="polite">
                        {q}
                      </span>
                      <button type="button" onClick={() => change(v.id, q + 1)} disabled={units >= MAX_QTY} aria-label={`Încă o pereche, ${label}`} className="flex h-10 w-11 items-center justify-center text-ink disabled:text-[var(--lp-muted)]">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        {/* The selection, always in view on large screens. */}
        <div ref={summaryRef} className="rounded-[22px] bg-paper p-5 shadow-[inset_0_0_0_1px_var(--lp-line)] sm:p-6 lg:sticky lg:top-6 lg:col-span-4">
          <div aria-live="polite" className={`rounded-[14px] p-4 ${active ? 'bg-ink text-white' : 'bg-[var(--lp-bg)]'}`}>
            <p className={`flex items-center gap-2 text-[20px] leading-tight font-semibold tracking-[-0.02em] ${active ? 'text-white' : 'text-ink'}`}>
              {active && <Check className="h-5 w-5 text-[#f5b041]" aria-hidden />}
              {status.big}
            </p>
            {status.small && <p className={`mt-1 text-[14.5px] leading-snug ${active ? 'text-white/80' : 'text-[var(--lp-muted)]'}`}>{status.small}</p>}
            <div className="mt-3 flex gap-1.5" aria-hidden>
              {steps.map((on, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${on ? 'bg-[#f5b041]' : active ? 'bg-white/20' : 'bg-[var(--lp-line)]'}`} />
              ))}
            </div>
          </div>

          <h3 className="mt-5 text-[15px] font-semibold text-ink">Selecția ta</h3>
          {lines.length === 0 ? (
            <p className="mt-2 text-[15px] text-[var(--lp-muted)]">Aici apar perechile alese.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--lp-line)]">
              {lines.map((l) => (
                <li key={l.variant.id} className="flex items-center gap-3 py-2.5 text-[15px]">
                  <span className="flex-1 text-ink">
                    {variantLabel(product, l.variant)} <span className="text-[var(--lp-muted)]">× {l.quantity}</span>
                  </span>
                  <span className="text-ink tabular-nums">{formatLei(l.unit * l.quantity)}</span>
                  <button type="button" onClick={() => change(l.variant.id, 0)} aria-label={`Scoate ${variantLabel(product, l.variant)}`} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--lp-muted)] hover:text-ink">
                    <Close className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {lines.length > 0 && (
            <dl className="mt-3 space-y-1.5 border-t border-[var(--lp-line)] pt-3 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-[var(--lp-muted)]">Subtotal</dt>
                <dd className="tabular-nums">{formatLei(pricing.subtotalMinor)}</dd>
              </div>
              {pricing.promotions.map((a) => (
                <div key={a.id} className="flex justify-between font-medium text-ink">
                  <dt>Reducere 2+1</dt>
                  <dd className="tabular-nums">−{formatLei(a.amountMinor)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-1">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="text-[26px] font-medium tracking-[-0.02em] text-ink tabular-nums">{formatLei(pricing.totalMinor)}</dd>
              </div>
            </dl>
          )}

          <div className="mt-5">{cta}</div>
          <p className="mt-3 text-[13.5px] leading-snug text-[var(--lp-muted)]">
            {terms.vat}. Livrare gratuită. {cashOnDelivery.enabled ? 'Plată la livrare, card sau transfer.' : 'Card sau transfer.'} {terms.returnDays} zile să te răzgândești. Garanție {terms.warrantyYears} ani.
          </p>
        </div>
      </div>

      {/* Phones: the running total while choosing frames. */}
      <div
        aria-hidden={!(inSection && !summaryVisible && units > 0)}
        inert={!(inSection && !summaryVisible && units > 0)}
        data-sticky-bar
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--lp-line)] bg-paper/95 backdrop-blur-md transition-transform duration-300 lg:hidden ${inSection && !summaryVisible && units > 0 ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="lp-wrap flex items-center justify-between gap-4 py-3">
          <p className="min-w-0 leading-tight">
            <span className="block text-[14px] text-[var(--lp-muted)]">
              {units === 1 ? '1 pereche' : `${units} perechi`}
              {active ? ' · 2+1 activ' : ''}
            </span>
            <span className="block text-[18px] font-semibold text-ink tabular-nums">{formatLei(pricing.totalMinor)}</span>
          </p>
          <a href={checkoutHref(slug, picks.length ? picks : [])} onClick={go} className="cta sm !min-h-12">
            Continuă <Arrow />
          </a>
        </div>
      </div>
    </section>
  )
}
