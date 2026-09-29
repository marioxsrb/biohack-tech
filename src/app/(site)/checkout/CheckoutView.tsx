'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cloneElement, useEffect, useRef, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'
import { useCart, type ResolvedLine } from '@/components/cart/CartProvider'
import { cartStore, type CartLine } from '@/components/cart/cart-store'
import { Price } from '@/components/cart/Price'
import { Thumb } from '@/components/cart/Thumb'
import { OfferProgress } from '@/components/cart/OfferProgress'
import { Totals } from '@/components/cart/Totals'
import { Arrow, Bank, CardIcon, Lock, Mail } from '@/components/ui/icons'
import { productHref, products, resolveLine } from '@/content/catalog'
import { attributionParams } from '@/lib/attribution'
import { site, terms } from '@/config/site'
import { track } from '@/lib/analytics'
import { MARKETING_CONSENT_TEXT } from '@/lib/consent/marketing'
import {
  COUNTIES,
  DRAFT_KEY,
  emptyOrder,
  normalizeOrder,
  validateOrder,
  type FieldName,
  type OrderFields,
  type OrderForm,
  type PaymentMethod,
} from '@/lib/checkout'
import { formatLei } from '@/lib/money'
import { CardPayment, type CardApi } from './CardPayment'

/** Field order on screen, so the first error is focused first. */
const ORDER: FieldName[] = [
  'firstName', 'lastName', 'email', 'phone', 'company', 'cui', 'regCom', 'address', 'city', 'county', 'postalCode',
  'shipAddress', 'shipCity', 'shipCounty', 'shipPostalCode', 'notes', 'paymentMethod', 'acceptedTerms',
]

type Methods = Record<PaymentMethod, boolean>

const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

/**
 * Direct checkout from an advertising landing: /checkout?item=<productId>[:<variantId>] (repeatable).
 * Only ids arrive; unknown or unpriced ones are ignored, and the server prices the order again.
 */
function directItems(search: string): CartLine[] {
  return new URLSearchParams(search).getAll('item').flatMap((raw) => {
    const [productId, variantId] = raw.split(':')
    const r = resolveLine(productId, variantId || undefined)
    return r && r.unit !== null ? [{ productId: r.product.id, variantId: r.variant?.id, quantity: 1 }] : []
  })
}

export function CheckoutView({ methods, stripeKey }: { methods: Methods; stripeKey: string | null }) {
  const hydrated = useHydrated()
  const { lines } = useCart()
  const [direct] = useState(() => (typeof window === 'undefined' ? [] : directItems(window.location.search)))

  // Puts the landing's product in the cart (never twice), then drops ?item so a reload changes nothing.
  // The campaign parameters stay in the URL until the order is placed.
  useEffect(() => {
    if (!direct.length) return
    cartStore.restore(direct)
    const url = new URL(window.location.href)
    url.searchParams.delete('item')
    window.history.replaceState(window.history.state, '', url)
  }, [direct])

  if (!hydrated || (direct.length > 0 && lines.length === 0)) return <div className="min-h-[60vh]" aria-busy="true" />
  if (lines.length === 0) return <EmptyCheckout />
  return <CheckoutForm lines={lines} methods={{ card: methods.card && !!stripeKey, transfer: methods.transfer }} stripeKey={stripeKey} />
}

function EmptyCheckout() {
  return (
    <div className="max-w-[40em] py-6">
      <h1 className="text-[36px] tracking-[-0.035em] max-sm:text-[30px]">Coșul tău este gol.</h1>
      <p className="sub mt-3">Adaugă un produs în coș ca să poți finaliza comanda.</p>
      <ul className="mt-8 grid gap-2">
        {products.map((p) => (
          <li key={p.id}>
            <Link href={productHref(p)} className="group grid grid-cols-[88px_1fr_auto] items-center gap-4 rounded-[16px] bg-paper p-3 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-line)]">
              <Thumb image={p.cutout} className="h-[68px] w-[88px] bg-mist" />
              <span>
                <span className="block text-[17px] font-medium text-ink">{p.name}</span>
                <span className="block text-[14.5px] text-muted">
                  {p.purpose} · <Price productId={p.id} />
                </span>
              </span>
              <Arrow className="mr-2 h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function readDraft(methods: Methods): OrderForm {
  let draft = emptyOrder
  try {
    draft = normalizeOrder(JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}'))
  } catch {}
  if (!methods[draft.paymentMethod]) draft = { ...draft, paymentMethod: methods.card || !methods.transfer ? 'card' : 'transfer' }
  return draft
}

function CheckoutForm({ lines, methods, stripeKey }: { lines: ResolvedLine[]; methods: Methods; stripeKey: string | null }) {
  const router = useRouter()
  const { total, pricing, progress } = useCart()
  const anyMethod = methods.card || methods.transfer

  const [form, setForm] = useState<OrderForm>(() => readDraft(methods))
  const [accepted, setAccepted] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [attemptId] = useState(() => crypto.randomUUID())
  const card = useRef<CardApi | null>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    } catch {}
  }, [form])

  useEffect(() => {
    track('begin_checkout', { value: total, items: lines })
    // Once per visit of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const errors = validateOrder(form, accepted, methods)
  const show = (f: FieldName) => (submitted || touched[f] ? errors[f] : undefined)
  const pj = form.buyerType === 'pj'

  const bind = (f: keyof OrderFields) => ({
    id: `f-${f}`,
    value: form[f],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((o) => ({ ...o, [f]: e.target.value })),
    onBlur: () => setTouched((t) => ({ ...t, [f]: true })),
  })
  const patch = (p: Partial<OrderForm>) => setForm((o) => ({ ...o, ...p }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (sending) return
    setSubmitted(true)
    setServerError(null)
    const first = ORDER.find((f) => errors[f])
    if (first) {
      document.getElementById(first === 'paymentMethod' ? `pm-${form.paymentMethod}` : `f-${first}`)?.focus()
      return
    }
    setSending(true)
    try {
      // Card: Stripe checks the card fields first, so an incomplete card never creates an order.
      if (form.paymentMethod === 'card') {
        if (!card.current) throw new Error('Plata cu cardul se încarcă. Încearcă din nou într-o clipă.')
        const problem = await card.current.validate()
        if (problem) throw new Error(problem)
      }
      track('add_payment_info', { value: total, items: lines, payment_type: form.paymentMethod === 'card' ? 'card' : 'transfer bancar' })

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: lines.map((l) => ({ productId: l.product.id, variantId: l.variant?.id, quantity: l.quantity })),
          order: form,
          acceptedTerms: accepted,
          attemptId,
          // Landing and UTM parameters from the URL, if any. The server validates them.
          attribution: Object.fromEntries(attributionParams(window.location.search)),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? 'Ceva nu a funcționat. Încearcă din nou.')

      const orderUrl = `/comanda/${data.token}`
      if (data.method === 'transfer' || data.paid || data.submitted) {
        router.push(orderUrl)
        return
      }
      // Stripe confirms the payment (3-D Secure included) and returns to the order page.
      const failure = await card.current!.confirm(data.clientSecret, `${window.location.origin}${orderUrl}`, {
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        phone: form.phone,
        address: { line1: form.address, city: form.city, state: form.county, postal_code: form.postalCode, country: 'RO' },
      })
      if (failure) throw new Error(failure)
    } catch (err) {
      setServerError(err instanceof Error && err.message ? err.message : 'Nu ne-am putut conecta. Verifică internetul și încearcă din nou.')
      setSending(false)
    }
  }

  const mailtoOrder = `mailto:${site.email}?subject=${encodeURIComponent('Comandă de pe site')}&body=${encodeURIComponent(
    `Bună ziua,\n\nAș dori să comand:\n${lines.map((l) => `- ${l.quantity} x ${l.product.name}${l.variantLabel ? ` (${l.variantLabel})` : ''}`).join('\n')}\n\nMulțumesc!`,
  )}`
  const count = lines.reduce((n, l) => n + l.quantity, 0)

  return (
    <form onSubmit={submit} noValidate aria-busy={sending}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[clamp(30px,3.4vw,40px)] leading-tight tracking-[-0.035em]">Finalizează comanda</h1>
        <p className="flex items-center gap-2 text-[14.5px] text-muted">
          <Lock className="h-4 w-4" /> Conexiune securizată
        </p>
      </div>

      {/* Phones: the order, folded, above the form */}
      <details className="faq group mt-5 rounded-[16px] bg-paper md:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 [&::-webkit-details-marker]:hidden">
          <span className="text-[15.5px] font-medium text-ink">
            Comanda ta <span className="font-normal text-muted">({count})</span>
          </span>
          <span className="flex items-center gap-2 text-[16px] font-medium text-ink tabular-nums">
            {formatLei(total)} <Arrow className="h-4 w-4 rotate-90 transition-transform group-open:-rotate-90" />
          </span>
        </summary>
        <div className="faq-body">
          <ul className="divide-y divide-mist-2 border-t border-mist-2 px-5">
            {lines.map((l) => (
              <SummaryLine key={l.key} line={l} />
            ))}
          </ul>
        </div>
      </details>

      <div className="mt-6 grid gap-y-6 md:mt-8 md:grid-cols-12 md:gap-x-8 lg:gap-x-12">
        {!anyMethod ? (
          <div className="md:col-span-7">
            <div className="rounded-[20px] bg-paper p-6 max-sm:px-5">
              <h2 className="text-[22px] tracking-[-0.02em]">Comenzile online se activează în curând.</h2>
              <p className="mt-3 max-w-[34em] text-[16px] leading-relaxed text-text">
                Până atunci, comanzi direct la noi. Scrie-ne sau sună-ne și confirmăm împreună produsele, livrarea și plata. Îți răspundem {terms.responseTime}.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={mailtoOrder} className="cta">
                  <Mail /> Comandă pe email
                </a>
                <a href={site.phoneHref} className="btn-secondary">
                  Sună la {site.phone}
                </a>
              </div>
              <p className="mt-4 text-[14px] text-muted">Emailul se deschide cu produsele din coș deja scrise.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 md:col-span-7">
            <Group n={1} title="Date de contact">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="firstName" label="Prenume" error={show('firstName')}>
                  <input autoComplete="given-name" {...bind('firstName')} />
                </Field>
                <Field name="lastName" label="Nume" error={show('lastName')}>
                  <input autoComplete="family-name" {...bind('lastName')} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="email" label="Email" hint="Aici primești confirmarea comenzii." error={show('email')}>
                  <input type="email" inputMode="email" autoComplete="email" spellCheck={false} {...bind('email')} />
                </Field>
                <Field name="phone" label="Telefon" hint="Pentru curier." error={show('phone')}>
                  <input type="tel" inputMode="tel" autoComplete="tel" {...bind('phone')} />
                </Field>
              </div>
            </Group>

            <Group n={2} title="Facturare">
              <div role="radiogroup" aria-label="Facturez pe" className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['pf', 'Persoană fizică', 'Factura pe numele tău'],
                    ['pj', 'Persoană juridică', 'Factura pe firmă'],
                  ] as const
                ).map(([v, label, sub]) => (
                  <label
                    key={v}
                    className={`flex min-h-16 cursor-pointer flex-col justify-center rounded-[12px] px-4 py-3 transition-shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cyan ${
                      form.buyerType === v
                        ? 'bg-paper shadow-[inset_0_0_0_2px_var(--color-ink)]'
                        : 'bg-mist shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-faint)]'
                    }`}
                  >
                    <input type="radio" name="buyerType" value={v} checked={form.buyerType === v} onChange={() => patch({ buyerType: v })} className="sr-only" />
                    <span className="text-[15.5px] font-semibold text-ink">{label}</span>
                    <span className="text-[13.5px] text-muted">{sub}</span>
                  </label>
                ))}
              </div>

              {pj && (
                <>
                  <Field name="company" label="Denumirea firmei" error={show('company')}>
                    <input autoComplete="organization" {...bind('company')} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field name="cui" label="Cod fiscal (CUI)" hint="Cu sau fără RO." error={show('cui')}>
                      <input autoCapitalize="characters" spellCheck={false} {...bind('cui')} />
                    </Field>
                    <Field name="regCom" label="Nr. Registrul Comerțului" optional>
                      <input spellCheck={false} {...bind('regCom')} />
                    </Field>
                  </div>
                </>
              )}

              <Field name="address" label={pj ? 'Adresa sediului' : 'Adresa'} hint="Stradă, număr, bloc, scară, apartament." error={show('address')}>
                <input autoComplete={pj ? 'off' : 'billing street-address'} {...bind('address')} />
              </Field>
              <AddressLine prefix="" bind={bind} show={show} autoComplete={!pj} />
              <p className="text-[14px] text-muted">Țara: România</p>
            </Group>

            <Group n={3} title="Livrare">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15.5px] text-ink">
                <input type="checkbox" checked={form.sameAddress} onChange={(e) => patch({ sameAddress: e.target.checked })} className="h-5 w-5 flex-none accent-[var(--color-ink)]" />
                Adresa de livrare este aceeași cu adresa de facturare
              </label>
              {!form.sameAddress && (
                <>
                  <Field name="shipAddress" label="Adresa de livrare" hint="Stradă, număr, bloc, scară, apartament." error={show('shipAddress')}>
                    <input autoComplete="shipping street-address" {...bind('shipAddress')} />
                  </Field>
                  <AddressLine prefix="ship" bind={bind} show={show} autoComplete />
                </>
              )}
              <Field name="notes" label="Observații pentru curier" optional>
                <textarea rows={2} {...bind('notes')} />
              </Field>
              <p className="rounded-[12px] bg-mist px-4 py-3 text-[14.5px] text-text">Livrare gratuită prin curier, oriunde în România.</p>
            </Group>

            <Group n={4} title="Plată">
              <div role="radiogroup" aria-label="Metoda de plată" className="grid gap-2">
                <PayOption
                  id="card"
                  icon={<CardIcon className="h-6 w-6" />}
                  title="Card bancar"
                  text="Plătești acum. Datele cardului merg direct la Stripe, procesatorul nostru de plăți."
                  available={methods.card}
                  checked={form.paymentMethod === 'card'}
                  onSelect={() => patch({ paymentMethod: 'card' })}
                >
                  {methods.card && stripeKey && (
                    <div className={form.paymentMethod === 'card' ? 'mt-4' : 'hidden'}>
                      <CardPayment publishableKey={stripeKey} amount={total} apiRef={card} />
                      <p className="mt-3 text-[13px] leading-relaxed text-muted">
                        După plată îți putem propune un produs opțional. Stripe păstrează cardul asociat acestei comenzi 30 de minute, ca să-l poți adăuga doar dacă vrei,
                        confirmând din nou. Noi nu vedem și nu stocăm datele cardului.
                      </p>
                    </div>
                  )}
                </PayOption>
                <PayOption
                  id="transfer"
                  icon={<Bank className="h-6 w-6" />}
                  title="Transfer bancar"
                  text="Primești datele pentru plată imediat după comandă. Pregătim coletul după ce primim plata."
                  available={methods.transfer}
                  checked={form.paymentMethod === 'transfer'}
                  onSelect={() => patch({ paymentMethod: 'transfer' })}
                />
              </div>
              {show('paymentMethod') && <p className="text-[14px] text-red-deep">{errors.paymentMethod}</p>}
            </Group>
          </div>
        )}

        <aside className="md:col-span-5" aria-labelledby="summary-title">
          <div className="rounded-[20px] bg-paper p-6 md:sticky md:top-[calc(var(--nav-h)+24px)] max-sm:p-5">
            <div className="flex items-baseline justify-between">
              <h2 id="summary-title" className="text-[20px] tracking-[-0.015em]">
                Comanda ta
              </h2>
              <Link href="/cart" className="-mr-2 flex min-h-11 items-center rounded px-2 text-[15px] text-muted underline underline-offset-4 hover:text-ink">
                Modifică
              </Link>
            </div>

            <ul className="mt-2 divide-y divide-mist-2 border-y border-mist-2 max-md:hidden">
              {lines.map((l) => (
                <SummaryLine key={l.key} line={l} />
              ))}
            </ul>

            <div className="mt-4">
              <Totals pricing={pricing} />
            </div>
            <p className="text-right text-[13px] text-muted">{terms.vat}</p>
            <OfferProgress progress={progress} lines={lines} actions={false} className="mt-4" />

            {anyMethod && (
              <>
                <div className="mt-5 space-y-3 border-t border-mist-2 pt-5">
                  <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug text-text">
                    <input
                      id="f-acceptedTerms"
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      aria-invalid={!!show('acceptedTerms')}
                      aria-describedby={show('acceptedTerms') ? 'e-acceptedTerms' : undefined}
                      className="mt-0.5 h-5 w-5 flex-none accent-[var(--color-ink)]"
                    />
                    <span>
                      Am citit și accept{' '}
                      <Link href="/terms-of-service" target="_blank" className="font-medium text-ink underline underline-offset-4">
                        termenii și condițiile
                      </Link>{' '}
                      și{' '}
                      <Link href="/politica-retur" target="_blank" className="font-medium text-ink underline underline-offset-4">
                        politica de retur și retragere
                      </Link>
                      .
                    </span>
                  </label>
                  {show('acceptedTerms') && (
                    <p id="e-acceptedTerms" className="text-[14px] text-red-deep">
                      {errors.acceptedTerms}
                    </p>
                  )}
                  <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug text-text">
                    <input
                      type="checkbox"
                      checked={form.marketingConsent}
                      onChange={(e) => patch({ marketingConsent: e.target.checked })}
                      className="mt-0.5 h-5 w-5 flex-none accent-[var(--color-ink)]"
                    />
                    <span>
                      {MARKETING_CONSENT_TEXT} <span className="text-muted">(opțional)</span>
                    </span>
                  </label>
                  <p className="text-[13.5px] leading-snug text-muted">
                    Folosim datele tale ca să procesăm, să facturăm și să livrăm comanda. Detalii în{' '}
                    <Link href="/privacy-policy" target="_blank" className="underline underline-offset-4 hover:text-ink">
                      politica de confidențialitate
                    </Link>
                    .
                  </p>
                </div>

                {submitted && Object.keys(errors).length > 0 && !serverError && (
                  <p role="alert" className="mt-4 text-[14.5px] text-red-deep">
                    Completează câmpurile marcate cu roșu.
                  </p>
                )}
                {serverError && (
                  <p role="alert" className="mt-4 rounded-[12px] bg-paper px-4 py-3 text-[14.5px] leading-snug text-ink shadow-[inset_0_0_0_1px_var(--color-red)]">
                    {serverError}
                  </p>
                )}

                <button type="submit" disabled={sending} className="cta mt-5 w-full disabled:cursor-wait disabled:opacity-80">
                  {sending ? (
                    <>
                      <span aria-hidden className="spinner" /> {form.paymentMethod === 'card' ? 'Se procesează plata…' : 'Se trimite comanda…'}
                    </>
                  ) : form.paymentMethod === 'card' ? (
                    <>
                      <Lock /> Plătește {formatLei(total)}
                    </>
                  ) : (
                    // OUG 34/2014 art. 8(2): the button says the order implies an obligation to pay.
                    <>Comandă cu obligație de plată</>
                  )}
                </button>
                <p className="mt-3 text-center text-[14px] leading-snug text-text">
                  {form.paymentMethod === 'card'
                    ? 'Plata se face în siguranță prin Stripe. După plată primești confirmarea pe email.'
                    : 'Comanda se înregistrează imediat. Datele pentru transfer apar pe pagina următoare și în email.'}
                </p>
                <p className="mt-2 text-center text-[13.5px] leading-snug text-muted">
                  <Link href="/politica-retur" target="_blank" className="underline underline-offset-4 hover:text-ink">
                    Drept de retragere {terms.returnDays} zile
                  </Link>{' '}
                  ·{' '}
                  <Link href="/garantie" target="_blank" className="underline underline-offset-4 hover:text-ink">
                    garanție legală de conformitate {terms.warrantyYears} ani
                  </Link>
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </form>
  )
}

function AddressLine({
  prefix,
  bind,
  show,
  autoComplete,
}: {
  prefix: '' | 'ship'
  bind: (f: keyof OrderFields) => Record<string, unknown>
  show: (f: FieldName) => string | undefined
  autoComplete: boolean
}) {
  const k = (f: 'city' | 'county' | 'postalCode') => (prefix ? (`ship${f[0].toUpperCase()}${f.slice(1)}` as keyof OrderFields) : f)
  const ac = (v: string) => (autoComplete ? `${prefix ? 'shipping' : 'billing'} ${v}` : 'off')
  return (
    <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr_0.8fr]">
      <Field name={k('city')} label="Localitate" error={show(k('city'))}>
        <input autoComplete={ac('address-level2')} {...bind(k('city'))} />
      </Field>
      <Field name={k('county')} label="Județ" error={show(k('county'))}>
        <select autoComplete={ac('address-level1')} {...bind(k('county'))}>
          <option value="">Alege</option>
          {COUNTIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field name={k('postalCode')} label="Cod poștal" error={show(k('postalCode'))}>
        <input inputMode="numeric" autoComplete={ac('postal-code')} maxLength={6} {...bind(k('postalCode'))} />
      </Field>
    </div>
  )
}

function PayOption({
  id,
  icon,
  title,
  text,
  available,
  checked,
  onSelect,
  children,
}: {
  id: PaymentMethod
  icon: ReactNode
  title: string
  text: string
  available: boolean
  checked: boolean
  onSelect: () => void
  children?: ReactNode
}) {
  const on = checked && available
  return (
    <div className={`rounded-[14px] p-4 transition-shadow ${available ? 'bg-paper' : 'bg-mist'} ${on ? 'shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)]'}`}>
      <label
        className={`flex items-start gap-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-cyan ${available ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      >
        <input id={`pm-${id}`} type="radio" name="paymentMethod" value={id} checked={on} disabled={!available} onChange={onSelect} className="sr-only" />
        <span aria-hidden className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full ${on ? 'bg-ink' : 'bg-paper shadow-[inset_0_0_0_1.5px_var(--color-faint)]'}`}>
          {on && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className={`text-[16.5px] font-medium ${available ? 'text-ink' : 'text-muted'}`}>{title}</span>
            {!available && <span className="rounded-full bg-paper px-2 py-0.5 text-[12.5px] font-medium text-muted">În curând</span>}
          </span>
          <span className={`mt-0.5 block text-[14.5px] leading-snug ${available ? 'text-text' : 'text-muted'}`}>{text}</span>
        </span>
        <span className={available ? 'text-ink' : 'text-faint'}>{icon}</span>
      </label>
      {children}
    </div>
  )
}

function SummaryLine({ line: l }: { line: ResolvedLine }) {
  return (
    <li className="grid grid-cols-[72px_1fr_auto] items-center gap-3.5 py-3.5">
      <span className="relative">
        <Thumb image={l.variant?.images[0] ?? l.product.cutout} sizes="72px" className="h-14 w-[72px] bg-mist" />
        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11.5px] font-semibold text-white tabular-nums">
          {l.quantity}
        </span>
      </span>
      <span className="min-w-0 text-[14.5px] leading-snug">
        <span className="block font-medium text-ink">{l.product.name}</span>
        <span className="block text-muted">{l.variantLabel ?? l.product.purpose}</span>
        {l.quantity > 1 && <span className="block text-[13px] text-muted">{formatLei(l.unit)} / buc.</span>}
      </span>
      <span className="text-[15px] font-medium text-ink tabular-nums">{formatLei(l.unit * l.quantity)}</span>
    </li>
  )
}

/** One numbered group of the form, on its own white panel. */
function Group({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-[20px] bg-paper p-6 max-sm:px-5">
      <legend className="float-left mb-5 flex w-full items-center gap-3 text-[19px] font-medium tracking-[-0.015em] text-ink">
        <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-mist text-[13.5px] font-semibold tabular-nums">
          {n}
        </span>
        {title}
      </legend>
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  )
}

function Field({
  name,
  label,
  hint,
  error,
  optional,
  children,
}: {
  name: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  children: ReactElement<Record<string, unknown>>
}) {
  const described = [hint && !error && `h-${name}`, error && `e-${name}`].filter(Boolean).join(' ') || undefined
  const control = cloneElement(children, {
    id: `f-${name}`,
    'aria-invalid': !!error,
    'aria-describedby': described,
    'aria-required': optional ? undefined : true,
    className: `field ${error ? 'field-error' : ''}`,
  })
  return (
    <div>
      <label htmlFor={`f-${name}`} className="mb-1.5 block text-[14.5px] font-medium text-ink">
        {label} {optional && <span className="font-normal text-muted">(opțional)</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={`h-${name}`} className="mt-1.5 text-[13.5px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`e-${name}`} className="mt-1.5 text-[14px] text-red-deep">
          {error}
        </p>
      )}
    </div>
  )
}
