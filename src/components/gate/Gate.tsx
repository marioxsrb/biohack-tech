'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Sheet } from '@/components/offers/Sheet'
import { Arrow } from '@/components/ui/icons'
import { getProduct, getProductBySlug, type ProductId } from '@/content/catalog'
import { attributionParams } from '@/lib/attribution'
import { trackFunnel } from '@/lib/analytics'
import { CALL_CONSENT_TEXT } from '@/lib/consent/calling'
import { MARKETING_CONSENT_TEXT } from '@/lib/consent/marketing'
import { GATE_COOKIE, LEAD_PRIVACY_TEXT, normalizeContact, validateContact, type LeadErrors } from '@/lib/lead'

/**
 * The price gate of acces.<domain>: the same storefront as the main site (same pages, same components), with
 * every price blurred and every purchase control opening a short form until the visitor gives name, email
 * and phone (or already did on this device: the first-party gate cookie). One mechanism for the whole site:
 *
 *   - GATE_SCRIPT runs in <head> before the first paint: on the acces host it sets <html data-gated="1"
 *     data-gate="locked|open">, so prices are blurred from the very first frame (globals.css: [data-price]).
 *   - GateRoot (in the root layout) intercepts clicks on purchase controls ([data-buy]) while locked and opens
 *     the form; after it, data-gate becomes "open" and every price and button works, on every page.
 *   - GateLabel swaps a button's label ("Vezi prețul și oferta") with CSS, so nothing flickers.
 *
 * A presentation and conversion mechanism, not a secret: prices are public on the main site.
 */
export const GATE_SCRIPT = `(function(){try{if(!/^acces\\./.test(location.hostname))return;var d=document.documentElement;d.setAttribute('data-gated','1');d.setAttribute('data-gate',/(?:^|; )${GATE_COOKIE}=/.test(document.cookie)?'open':'locked')}catch(e){}})()`

type Target = { productId?: ProductId; variantId?: string }
type Gate = { gated: boolean; locked: boolean; open: (target?: Target) => void }

const GateContext = createContext<Gate>({ gated: false, locked: false, open: () => {} })
export const useGate = () => useContext(GateContext)

const productFromPath = (path: string) => getProductBySlug(/^(?:\/en)?\/products\/([\w-]+)/.exec(path)?.[1] ?? '')

export function GateRoot({ children }: { children: ReactNode }) {
  const [gated, setGated] = useState(false)
  const [locked, setLocked] = useState(false)
  const [form, setForm] = useState<Target | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const d = document.documentElement
    // Set by GATE_SCRIPT before hydration; read once here so React and the CSS agree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGated(d.dataset.gated === '1')
    setLocked(d.dataset.gate === 'locked')
  }, [])

  const open = useCallback((target: Target = {}) => {
    trackFunnel('PriceRevealClick', { product: target.productId, funnel: 'gated_price' })
    setForm(target)
  }, [])

  // While locked, every purchase control opens the form instead (capture phase: before the control's own handler).
  useEffect(() => {
    if (!gated || !locked) return
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-buy]') as HTMLElement | null
      if (!el) return
      e.preventDefault()
      e.stopPropagation()
      const id = el.dataset.product ?? productFromPath(location.pathname)?.id
      open({ productId: id && getProduct(id) ? (id as ProductId) : undefined, variantId: el.dataset.variant || undefined })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [gated, locked, open])

  // An unlocked device opening a product page: one lead for that interest too (no details are sent again).
  useEffect(() => {
    if (!gated || locked) return
    const product = productFromPath(pathname)
    if (!product) return
    const key = `bt-interest-${product.id}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {}
    void fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'interest', productId: product.id, attribution: Object.fromEntries(attributionParams(location.search)) }) }).catch(() => {})
  }, [gated, locked, pathname])

  const value = useMemo<Gate>(() => ({ gated, locked: gated && locked, open }), [gated, locked, open])
  return (
    <GateContext.Provider value={value}>
      {children}
      {gated && (
        <LeadForm
          target={form}
          onClose={() => setForm(null)}
          onUnlocked={() => {
            document.documentElement.setAttribute('data-gate', 'open')
            setLocked(false)
            setForm(null)
          }}
        />
      )}
    </GateContext.Provider>
  )
}

function LeadForm({ target, onClose, onUnlocked }: { target: Target | null; onClose: () => void; onUnlocked: () => void }) {
  const [values, setValues] = useState({ name: '', email: '', phone: '' })
  const [consent, setConsent] = useState(false)
  const [callConsent, setCallConsent] = useState(false)
  const [errors, setErrors] = useState<LeadErrors>({})
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')
  const started = useRef(false)
  const product = target?.productId ? getProduct(target.productId) : undefined

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
        body: JSON.stringify({ action: 'reveal', ...contact, productId: target.productId, variantId: target.variantId, marketingConsent: consent, callConsent, page: location.pathname, attribution: Object.fromEntries(attributionParams(location.search)) }),
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
          {product ? `Prețul și oferta pentru ${product.name}` : 'Prețurile și ofertele de azi'}
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
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-[14.5px] leading-snug text-text">
          <input type="checkbox" checked={callConsent} onChange={(e) => setCallConsent(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[var(--color-ink)]" />
          <span>
            {CALL_CONSENT_TEXT} <span className="text-muted">(opțional)</span>
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
