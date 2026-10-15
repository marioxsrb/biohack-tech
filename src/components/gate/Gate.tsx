'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Sheet } from '@/components/offers/Sheet'
import { cartStore } from '@/components/cart/cart-store'
import { Arrow } from '@/components/ui/icons'
import { getProduct, getProductBySlug, type ProductId } from '@/content/catalog'
import { attributionParams } from '@/lib/attribution'
import { trackFunnel } from '@/lib/analytics'
import { CommunicationsConsent } from '@/components/consent/CommunicationsConsent'
import { GATE_COOKIE, LEAD_PRIVACY_TEXT, normalizeContact, validateContact, type LeadErrors } from '@/lib/lead'
import { deviceHash, GATE_STORAGE_KEY } from '@/lib/device'

/**
 * The price gate of acces.<domain>: the same storefront as the main site (same pages, same components), with
 * every price blurred and every purchase control opening a short form until the visitor gives name, email
 * and phone (or already did on this device: the first-party gate cookie). One mechanism for the whole site:
 *
 *   - GATE_SCRIPT runs in <head> before the first paint: on the acces host without the gate cookie it adds a
 *     <style id="bt-gate"> that blurs every [data-price] and shows the "Vezi prețul și oferta" labels, so
 *     prices are hidden from the very first frame. (A <style> node, not attributes on <html>: React resets the
 *     root element's attributes when it hydrates in production, but leaves added <head> nodes alone.)
 *   - GateRoot (in the root layout) intercepts clicks on purchase controls ([data-buy]) while locked and opens
 *     the form; after it, the style is removed and every price and button works, on every page.
 *   - GateLabel renders both labels; the style picks the locked one, so nothing flickers.
 *   - A device that already gave its details is recognised without the form (once per browser session): by the
 *     lead id it kept in localStorage, by its device key (lib/device.ts, server/device.ts), or by the email typed
 *     again in the form ("Ai mai completat?").
 *
 * A presentation and conversion mechanism, not a secret: prices are public on the main site.
 */
export const GATE_CSS = '[data-price]{filter:blur(7px)!important;-webkit-user-select:none;user-select:none}.gate-label-locked{display:inline!important}.gate-label-open{display:none!important}'
export const GATE_STYLE_ID = 'bt-gate'
const isGatedHere = () => /^acces\./.test(location.hostname)
const unlockedHere = () => new RegExp(`(?:^|; )${GATE_COOKIE}=`).test(document.cookie)
export const GATE_SCRIPT = `(function(){try{if(!/^acces\\./.test(location.hostname)||/(?:^|; )${GATE_COOKIE}=/.test(document.cookie)||document.getElementById('${GATE_STYLE_ID}'))return;var s=document.createElement('style');s.id='${GATE_STYLE_ID}';s.textContent=${JSON.stringify(GATE_CSS)};document.head.appendChild(s)}catch(e){}})()`

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

  const unlock = useCallback(() => {
    document.getElementById(GATE_STYLE_ID)?.remove()
    setLocked(false)
    setForm(null)
  }, [])

  useEffect(() => {
    // Same rule as GATE_SCRIPT (which already blurred the page before hydration): the acces host, no gate cookie.
    const gatedHere = isGatedHere()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGated(gatedHere)
    setLocked(gatedHere && !unlockedHere())
    if (gatedHere && !unlockedHere() && !document.getElementById(GATE_STYLE_ID)) {
      const st = document.createElement('style')
      st.id = GATE_STYLE_ID
      st.textContent = GATE_CSS
      document.head.appendChild(st)
    }
    if (gatedHere && !unlockedHere()) void recognize().then((ok) => ok === true && unlock())
  }, [unlock])

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

  // An unlocked device changing its cart: the server learns it (products and quantities only), so an AI call about
  // an abandoned cart can follow 20 minutes after the last change instead of 30 after the form.
  useEffect(() => {
    if (!gated || locked) return
    const snap = () => JSON.stringify(cartStore.getSnapshot().map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })))
    let last = snap()
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = cartStore.subscribe(() => {
      const now = snap()
      if (now === last) return
      last = now
      clearTimeout(timer)
      timer = setTimeout(() => void fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true, body: JSON.stringify({ action: 'cart', cart: JSON.parse(now) }) }).catch(() => {}), 1500)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [gated, locked])

  const value = useMemo<Gate>(() => ({ gated, locked: gated && locked, open }), [gated, locked, open])
  return (
    <GateContext.Provider value={value}>
      {children}
      {gated && (
        <LeadForm
          target={form}
          onClose={() => setForm(null)}
          onUnlocked={unlock}
        />
      )}
    </GateContext.Provider>
  )
}

const remember = (leadId?: string) => {
  try {
    if (leadId) localStorage.setItem(GATE_STORAGE_KEY, leadId)
  } catch {}
}

/** Asks the server whether this device already gave its details (once per browser session). */
async function recognize(email?: string): Promise<boolean | 'invalid'> {
  const once = 'bt-gate-checked'
  try {
    if (!email && sessionStorage.getItem(once)) return false
    if (!email) sessionStorage.setItem(once, '1')
  } catch {}
  let saved: string | null = null
  try {
    saved = localStorage.getItem(GATE_STORAGE_KEY)
  } catch {}
  try {
    // The email check is only the email (the device was already checked when the page opened).
    const body = email ? { action: 'recognize', email } : { action: 'recognize', saved, device: await deviceHash() }
    const res = await fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (res.status === 422) return 'invalid'
    const data = (await res.json().catch(() => ({}))) as { unlocked?: boolean; leadId?: string }
    if (data.unlocked) remember(data.leadId)
    return !!data.unlocked
  } catch {
    return false
  }
}

function LeadForm({ target, onClose, onUnlocked }: { target: Target | null; onClose: () => void; onUnlocked: () => void }) {
  const [values, setValues] = useState({ name: '', email: '', phone: '' })
  // Two boxes: the terms, required (business decision 15.10.2026); the communications box, optional, names email
  // and AI calls, so both consents follow it (never a condition for the price).
  const [terms, setTerms] = useState(false)
  const [consent, setConsent] = useState(false)
  const callConsent = consent
  // "Ai mai completat?": the email alone shows the price again for someone who already gave their details.
  const [returning, setReturning] = useState(false)
  const [notFound, setNotFound] = useState(false)
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
    const found: LeadErrors = { ...validateContact(contact), ...(!terms && { terms: 'Bifează acceptarea Termenilor și Condițiilor ca să vezi prețul.' }) }
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
        body: JSON.stringify({
          action: 'reveal',
          ...contact,
          productId: target.productId,
          variantId: target.variantId,
          marketingConsent: consent,
          callConsent,
          termsAccepted: terms,
          device: await deviceHash(),
          page: location.pathname,
          attribution: Object.fromEntries(attributionParams(location.search)),
        }),
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
      remember(data.leadId)
      setState('idle')
      onUnlocked()
    } catch {
      setState('error')
    }
  }

  const submitReturning = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'sending') return
    const email = normalizeContact(values).email
    const bad = validateContact({ name: '', email, phone: '' }, ['email'])
    setErrors(bad.email ? { email: bad.email } : {})
    setNotFound(false)
    if (bad.email) return document.getElementById('lead-email')?.focus()
    setState('sending')
    const ok = await recognize(email)
    setState('idle')
    if (ok === 'invalid') return setErrors({ email: 'Verifică adresa de email.' })
    if (ok) return onUnlocked()
    setNotFound(true)
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
      {returning ? (
        <form onSubmit={submitReturning} noValidate className="mx-auto max-w-[480px]">
          <p className="text-[16px] leading-relaxed text-text">Scrie emailul cu care ai completat formularul și îți arătăm din nou prețul și oferta.</p>
          <div className="mt-5 grid gap-4">{field('email', 'Email', 'email', 'email')}</div>
          {notFound && (
            <p className="mt-4 text-[14.5px] text-red-deep">
              Nu găsim acest email.{' '}
              <button type="button" onClick={() => (setReturning(false), setNotFound(false))} className="font-medium underline underline-offset-4">
                Completează formularul
              </button>
              .
            </p>
          )}
          <button type="submit" disabled={state === 'sending'} className="cta mt-6 w-full">
            {state === 'sending' ? 'Căutăm…' : 'Vezi prețul'} <Arrow />
          </button>
          <button type="button" onClick={() => (setReturning(false), setNotFound(false))} className="mt-4 w-full text-center text-[14px] text-muted underline underline-offset-4 hover:text-ink">
            Înapoi la formular
          </button>
        </form>
      ) : (
        <form onSubmit={submit} noValidate className="mx-auto max-w-[480px]">
          <p className="text-[16px] leading-relaxed text-text">Completează cele trei câmpuri și îți arătăm imediat prețul și oferta de azi. Nu plătești nimic acum.</p>
          <div className="mt-5 grid gap-4">
            {field('name', 'Nume', 'text', 'name')}
            {field('email', 'Email', 'email', 'email')}
            {field('phone', 'Telefon', 'tel', 'tel', 'Pentru întrebări despre comandă.')}
          </div>
          <div className="mt-5 space-y-3">
            <label className="flex cursor-pointer items-start gap-3 text-[14.5px] leading-snug text-text">
              <input
                id="lead-terms"
                type="checkbox"
                name="termsAccepted"
                checked={terms}
                onChange={(e) => (setTerms(e.target.checked), e.target.checked && setErrors((x) => ({ ...x, terms: undefined })))}
                aria-invalid={!!errors.terms}
                className="mt-0.5 h-5 w-5 flex-none accent-[var(--color-ink)]"
              />
              <span>
                Accept{' '}
                <a href="/terms-of-service" target="_blank" rel="noopener" className="font-medium text-ink underline underline-offset-4">
                  Termenii și Condițiile
                </a>
                .
              </span>
            </label>
            {errors.terms && <p className="-mt-1 text-[13.5px] text-red-deep">{errors.terms}</p>}
            <CommunicationsConsent checked={consent} onChange={setConsent} className="text-[14.5px]" />
          </div>
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
          <button type="button" onClick={() => (setReturning(true), setErrors({}))} className="mt-4 w-full text-center text-[14px] text-muted underline underline-offset-4 hover:text-ink">
            Ai mai completat? Introdu doar emailul
          </button>
        </form>
      )}
    </Sheet>
  )
}
