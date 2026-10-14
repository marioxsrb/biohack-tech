'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Sheet } from '@/components/offers/Sheet'
import { Arrow, Lock } from '@/components/ui/icons'
import { getProduct, type ProductId } from '@/content/catalog'
import { attributionParams } from '@/lib/attribution'
import { trackFunnel } from '@/lib/analytics'
import { MARKETING_CONSENT_TEXT } from '@/lib/consent/marketing'
import { GATE_COOKIE, LEAD_PRIVACY_TEXT, normalizeContact, validateContact, type LeadErrors } from '@/lib/lead'
import { formatLei } from '@/lib/money'
import { terms } from '@/config/site'

/**
 * The price gate of the acces.<domain> funnel. Outside it (the main site and its landings) there is no provider
 * and every price shows as before. Inside it, prices and purchase controls render only after the visitor gave
 * name, email and phone (or already did on this device: a first-party cookie holding an opaque lead id). The
 * server's HTML of a gated page carries no price. This is a conversion experiment, not a protection: prices
 * are public on the main site.
 */
type Gate = { gated: boolean; unlocked: boolean; open: (productId: ProductId, variantId?: string) => void }

const OPEN: Gate = { gated: false, unlocked: true, open: () => {} }
const GateContext = createContext<Gate>(OPEN)

export const useGate = () => {
  const g = useContext(GateContext)
  return { ...g, locked: g.gated && !g.unlocked }
}

const readGate = () => (typeof document === 'undefined' ? null : (document.cookie.split('; ').find((c) => c.startsWith(`${GATE_COOKIE}=`))?.split('=')[1] ?? null))

export function GateProvider({ productId, children }: { productId?: ProductId; children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [form, setForm] = useState<{ productId: ProductId; variantId?: string } | null>(null)

  useEffect(() => {
    const lead = readGate()
    if (!lead) return
    // Read after hydration so the server's HTML (always locked, no price) and the first client render agree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnlocked(true)
    // An unlocked device opening another product: one lead for that interest too (no details are sent again).
    if (!productId) return
    const key = `bt-interest-${productId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {}
    void fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'interest', productId, attribution: Object.fromEntries(attributionParams(location.search)) }) }).catch(() => {})
  }, [productId])

  const open = useCallback((p: ProductId, variantId?: string) => {
    trackFunnel('PriceRevealClick', { product: p, funnel: 'gated_price' })
    setForm({ productId: p, variantId })
  }, [])

  const value = useMemo<Gate>(() => ({ gated: true, unlocked, open }), [unlocked, open])
  return (
    <GateContext.Provider value={value}>
      {children}
      <LeadForm
        target={form}
        onClose={() => setForm(null)}
        onUnlocked={() => {
          setUnlocked(true)
          setForm(null)
        }}
      />
    </GateContext.Provider>
  )
}

/** "Vezi prețul și oferta": opens the form. Rendered in place of a price or purchase button while locked. */
export function RevealButton({ productId, variantId, className = 'cta', label = 'Vezi prețul și oferta' }: { productId: ProductId; variantId?: string; className?: string; label?: string }) {
  const { open } = useGate()
  return (
    <button type="button" onClick={() => open(productId, variantId)} className={className}>
      <Lock /> {label} <Arrow />
    </button>
  )
}

/** The locked purchase block: what happens next, and the button. */
export function RevealPanel({ productId, variantId }: { productId: ProductId; variantId?: string }) {
  return (
    <div>
      <p className="text-[17px] leading-relaxed text-[var(--lp-ink,var(--color-ink))]">Prețul și oferta de azi îți apar imediat, după trei câmpuri: nume, email și telefon.</p>
      <RevealButton productId={productId} variantId={variantId} className="cta mt-5 w-full sm:w-auto" />
      <p className="mt-3 text-[14px] text-[var(--lp-muted,var(--color-muted))]">Fără plată acum. Comanda o finalizezi doar dacă vrei.</p>
    </div>
  )
}

function LeadForm({ target, onClose, onUnlocked }: { target: { productId: ProductId; variantId?: string } | null; onClose: () => void; onUnlocked: () => void }) {
  const [values, setValues] = useState({ name: '', email: '', phone: '' })
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<LeadErrors>({})
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')
  const started = useRef(false)
  const product = target ? getProduct(target.productId) : undefined

  useEffect(() => {
    if (target) started.current = false
  }, [target])

  const change = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!started.current && target) {
      started.current = true
      trackFunnel('LeadFormStart', { product: target.productId, funnel: 'gated_price' })
    }
    setValues((v) => ({ ...v, [k]: e.target.value }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target || state === 'sending') return
    const contact = normalizeContact(values)
    const found = validateContact(contact)
    setErrors(found)
    if (Object.keys(found).length) {
      document.getElementById(`lead-${Object.keys(found)[0]}`)?.focus()
      return
    }
    setState('sending')
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reveal', ...contact, productId: target.productId, variantId: target.variantId, marketingConsent: consent, page: location.pathname, attribution: Object.fromEntries(attributionParams(location.search)) }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; leadId?: string; fields?: LeadErrors }
      if (res.status === 422 && data.fields) {
        setErrors(data.fields)
        setState('idle')
        return
      }
      if (!res.ok || !data.ok) throw new Error('lead')
      // Meta: Lead only now, after the server stored it; the lead id makes a repeat a duplicate.
      trackFunnel('Lead', { product: target.productId, funnel: 'gated_price' }, data.leadId)
      trackFunnel('PriceRevealed', { product: target.productId, funnel: 'gated_price' }, data.leadId ? `reveal-${data.leadId}` : undefined)
      setState('idle')
      onUnlocked()
      requestAnimationFrame(() => document.getElementById('comanda')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch {
      setState('error')
    }
  }

  const field = (k: 'name' | 'email' | 'phone', label: string, type: string, autoComplete: string, hint?: string) => (
    <div>
      <label htmlFor={`lead-${k}`} className="mb-1.5 block text-[14.5px] font-medium text-ink">
        {label}
      </label>
      <input
        id={`lead-${k}`}
        name={k}
        type={type}
        inputMode={k === 'phone' ? 'tel' : k === 'email' ? 'email' : undefined}
        autoComplete={autoComplete}
        value={values[k]}
        onChange={change(k)}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `lead-e-${k}` : hint ? `lead-h-${k}` : undefined}
        aria-required
        className={`field ${errors[k] ? 'field-error' : ''}`}
      />
      {errors[k] ? (
        <p id={`lead-e-${k}`} className="mt-1.5 text-[14px] text-red-deep">
          {errors[k]}
        </p>
      ) : (
        hint && (
          <p id={`lead-h-${k}`} className="mt-1.5 text-[13.5px] text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )

  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      label="Vezi prețul și oferta"
      title={
        <p className="text-[17px] font-semibold text-ink">
          Prețul și oferta pentru {product?.name ?? 'produs'}
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="mx-auto max-w-[480px]">
        <p className="text-[16px] leading-relaxed text-text">Completează cele trei câmpuri și îți arătăm imediat prețul și oferta de azi. Nu plătești nimic acum.</p>
        <div className="mt-5 grid gap-4">
          {field('name', 'Nume', 'text', 'name')}
          {field('email', 'Email', 'email', 'email')}
          {field('phone', 'Telefon', 'tel', 'tel', 'Pentru întrebări despre comandă.')}
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-[14.5px] leading-snug text-text">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[var(--color-ink)]" />
          <span>
            {MARKETING_CONSENT_TEXT} <span className="text-muted">(opțional)</span>
          </span>
        </label>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          {LEAD_PRIVACY_TEXT} Detalii în{' '}
          <a href="/privacy-policy" target="_blank" rel="noopener" className="underline underline-offset-2">
            politica de confidențialitate
          </a>
          .
        </p>
        {state === 'error' && <p className="mt-4 text-[14.5px] text-red-deep">Nu am putut salva datele. Verifică conexiunea și încearcă din nou.</p>}
        <button type="submit" disabled={state === 'sending'} className="cta mt-6 w-full">
          {state === 'sending' ? 'Pregătim prețul…' : 'Vezi prețul'} <Arrow />
        </button>
      </form>
    </Sheet>
  )
}

/**
 * The hero's price line on a gated page: nothing priced until the visitor gave their details, then the same
 * line the visible landing shows. `onDark` matches the hero's colours.
 */
export function GatedHeroPrice({ productId, onDark }: { productId: ProductId; onDark?: boolean }) {
  const { locked } = useGate()
  const p = getProduct(productId)
  if (locked || !p || p.price === null)
    return <p className={`mt-7 text-[16px] font-medium ${onDark ? 'text-white/85' : 'text-[var(--lp-muted)]'}`}>Prețul și oferta de azi îți apar după un formular scurt.</p>
  return (
    <p className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className={`text-[30px] font-medium tracking-[-0.03em] tabular-nums ${onDark ? 'text-white' : ''}`}>{formatLei(p.price)}</span>
      <span className={`text-[14px] ${onDark ? 'text-white/70' : 'text-[var(--lp-muted)]'}`}>{terms.vat} · livrare gratuită</span>
    </p>
  )
}

/** Renders its (non-price) children only once prices are visible: offer badges on a gated page. */
export function WhenUnlocked({ children }: { children: ReactNode }) {
  return useGate().locked ? null : <>{children}</>
}
