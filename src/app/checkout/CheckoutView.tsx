'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { cloneElement, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useCart, type ResolvedLine } from '@/components/cart/CartProvider'
import { ProductShot } from '@/components/product/ProductShot'
import { Arrow, Lock } from '@/components/ui/icons'
import { productHref } from '@/content/catalog'
import { terms } from '@/config/site'
import { COUNTIES, emptyCustomer, validateCustomer, type Customer, type FieldErrors } from '@/lib/checkout'
import { formatMoney, totalsByCurrency, type Currency } from '@/lib/money'

const DRAFT_KEY = 'biohack-checkout-draft'

const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

export function CheckoutView() {
  const hydrated = useHydrated()
  const { lines } = useCart()

  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />
  if (lines.length === 0) return <EmptyCheckout />
  return <CheckoutForm lines={lines} />
}

function EmptyCheckout() {
  return (
    <div className="max-w-[34em] py-10">
      <h1 className="text-[36px] tracking-[-0.035em] max-sm:text-[30px]">Coșul este gol.</h1>
      <p className="sub mt-3">Adaugă un produs în coș ca să poți finaliza comanda.</p>
      <Link href="/products" className="cta mt-8">
        Vezi produsele <Arrow />
      </Link>
    </div>
  )
}

function readDraft(): Customer {
  try {
    return { ...emptyCustomer, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}') }
  } catch {
    return emptyCustomer
  }
}

function CheckoutForm({ lines }: { lines: ResolvedLine[] }) {
  const cancelled = useSearchParams().get('anulat') === '1'
  const groups = useMemo(() => totalsByCurrency(lines), [lines])

  const [currency, setCurrency] = useState<Currency>(groups[0].currency)
  const [customer, setCustomer] = useState<Customer>(readDraft)
  const [accepted, setAccepted] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<keyof FieldErrors, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending'>('idle')
  const [serverError, setServerError] = useState<string | null>(null)

  // Keep the selected currency valid if the cart changes (e.g. a line removed in the drawer).
  const activeCurrency = groups.some((g) => g.currency === currency) ? currency : groups[0].currency
  const payLines = lines.filter((l) => l.unit.currency === activeCurrency)
  const laterLines = lines.filter((l) => l.unit.currency !== activeCurrency)
  const total = groups.find((g) => g.currency === activeCurrency)!

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(customer))
    } catch {}
  }, [customer])

  const errors = validateCustomer(customer, accepted)
  const show = (f: keyof FieldErrors) => (submitted || touched[f] ? errors[f] : undefined)

  const set = (f: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setCustomer((c) => ({ ...c, [f]: e.target.value }))
  const blur = (f: keyof FieldErrors) => () => setTouched((t) => ({ ...t, [f]: true }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (Object.keys(errors).length) {
      const first = Object.keys(errors)[0]
      document.getElementById(`f-${first}`)?.focus()
      return
    }
    setStatus('sending')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: activeCurrency,
          lines: payLines.map((l) => ({ productId: l.product.id, variantId: l.variant?.id, quantity: l.quantity })),
          customer,
          acceptedTerms: accepted,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.assign(data.url)
        return
      }
      setServerError(data.message ?? 'Ceva nu a funcționat. Încearcă din nou.')
    } catch {
      setServerError('Nu ne-am putut conecta. Verifică internetul și încearcă din nou.')
    }
    setStatus('idle')
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-y-10 md:grid-cols-12 md:gap-x-6 lg:gap-x-10">
      <div className="md:col-span-7">
        <h1 className="text-[36px] leading-tight tracking-[-0.035em] max-sm:text-[30px]">Finalizează comanda</h1>

        {cancelled && (
          <p role="status" className="mt-6 rounded-[12px] bg-mist px-5 py-4 text-[15px]">
            Plata a fost anulată și nu ți s-a retras nimic. Produsele sunt tot în coș.
          </p>
        )}

        <Fieldset title="Date de contact" n="01">
          <Field id="name" label="Nume și prenume" error={show('name')}>
            <input id="f-name" autoComplete="name" value={customer.name} onChange={set('name')} onBlur={blur('name')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="email" label="Email" hint="Aici primești confirmarea." error={show('email')}>
              <input id="f-email" type="email" inputMode="email" autoComplete="email" value={customer.email} onChange={set('email')} onBlur={blur('email')} />
            </Field>
            <Field id="phone" label="Telefon" hint="Pentru curier." error={show('phone')}>
              <input id="f-phone" type="tel" inputMode="tel" autoComplete="tel" value={customer.phone} onChange={set('phone')} onBlur={blur('phone')} />
            </Field>
          </div>
        </Fieldset>

        <Fieldset title="Adresa de livrare" n="02">
          <Field id="address" label="Stradă, număr, bloc, apartament" error={show('address')}>
            <input id="f-address" autoComplete="street-address" value={customer.address} onChange={set('address')} onBlur={blur('address')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr_0.8fr]">
            <Field id="city" label="Localitate" error={show('city')}>
              <input id="f-city" autoComplete="address-level2" value={customer.city} onChange={set('city')} onBlur={blur('city')} />
            </Field>
            <Field id="county" label="Județ" error={show('county')}>
              <select id="f-county" autoComplete="address-level1" value={customer.county} onChange={set('county')} onBlur={blur('county')}>
                <option value="">Alege</option>
                {COUNTIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field id="postalCode" label="Cod poștal" error={show('postalCode')}>
              <input id="f-postalCode" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={customer.postalCode} onChange={set('postalCode')} onBlur={blur('postalCode')} />
            </Field>
          </div>
          <Field id="notes" label="Observații pentru curier" optional>
            <textarea id="f-notes" rows={2} value={customer.notes} onChange={set('notes')} />
          </Field>
        </Fieldset>

        <div className="mt-8">
          <label className="flex cursor-pointer items-start gap-3 text-[15px]">
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
                politica de retur
              </Link>
              .
            </span>
          </label>
          {show('acceptedTerms') && (
            <p id="e-acceptedTerms" className="mt-2 text-[14px] text-red-deep">
              {errors.acceptedTerms}
            </p>
          )}
        </div>
      </div>

      <aside className="md:col-span-5" aria-label="Sumarul comenzii">
        <div className="rounded-[16px] bg-mist p-6 md:sticky md:top-[calc(var(--nav-h)+24px)] max-sm:-mx-2 max-sm:p-5">
          <h2 className="text-[19px] tracking-[-0.015em]">Comanda ta</h2>

          {groups.length > 1 && (
            <fieldset className="mt-4">
              <legend className="text-[14px] leading-snug text-text">
                Produsele au prețuri în monede diferite, așa că plata se face separat. Alege ce plătești acum:
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {groups.map((g) => (
                  <label
                    key={g.currency}
                    className={`cursor-pointer rounded-[10px] bg-paper px-3 py-2.5 text-[14px] transition-shadow ${
                      g.currency === activeCurrency ? 'shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)]'
                    }`}
                  >
                    <input type="radio" name="currency" value={g.currency} checked={g.currency === activeCurrency} onChange={() => setCurrency(g.currency)} className="sr-only" />
                    <span className="block text-muted">Plata în {g.currency}</span>
                    <span className="block font-medium text-ink tabular-nums">{formatMoney(g)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <ul className="mt-5 divide-y divide-mist-2 border-y border-mist-2">
            {payLines.map((l) => (
              <SummaryLine key={l.key} line={l} />
            ))}
          </ul>

          <dl className="mt-4 space-y-1.5 text-[15px]">
            <div className="flex justify-between">
              <dt className="text-muted">Livrare</dt>
              <dd className="text-ink">Gratuită</dd>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <dt className="font-medium text-ink">Total</dt>
              <dd className="text-[24px] font-medium tracking-[-0.02em] text-ink tabular-nums">{formatMoney(total)}</dd>
            </div>
          </dl>
          <p className="text-right text-[13px] text-muted">{terms.vat}</p>

          {serverError && (
            <p role="alert" className="mt-4 rounded-[10px] bg-paper px-4 py-3 text-[14.5px] leading-snug text-ink shadow-[inset_0_0_0_1px_var(--color-red)]">
              {serverError}
            </p>
          )}

          <button type="submit" disabled={status === 'sending'} className="cta mt-5 w-full">
            {status === 'sending' ? (
              'Se deschide plata…'
            ) : (
              <>
                <Lock /> Mergi la plata cu cardul
              </>
            )}
          </button>
          <p className="mt-3 text-center text-[14px] text-text">Următorul pas: plătești cu cardul, pe pagina securizată Stripe. Apoi primești confirmarea pe email.</p>

          {laterLines.length > 0 && (
            <div className="mt-6 border-t border-mist-2 pt-4">
              <p className="mono !text-[11px]">Rămân în coș, pentru o plată separată</p>
              <ul className="mt-2 space-y-1 text-[14px] text-muted">
                {laterLines.map((l) => (
                  <li key={l.key} className="flex justify-between gap-3">
                    <span>
                      {l.quantity} × {l.product.name}
                    </span>
                    <span className="tabular-nums">{formatMoney({ ...l.unit, amount: l.unit.amount * l.quantity })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </form>
  )
}

function SummaryLine({ line: l }: { line: ResolvedLine }) {
  return (
    <li className="grid grid-cols-[64px_1fr_auto] items-center gap-3 py-3">
      <Link href={productHref(l.product)} className="relative block h-12 overflow-hidden rounded-[8px]" tabIndex={-1} aria-hidden>
        <ProductShot image={l.variant?.images[0] ?? l.product.cutout} sizes="64px" inset="sm" className="!bg-paper" />
        <span className="absolute -top-0 right-0 flex h-5 min-w-5 items-center justify-center rounded-bl-[8px] bg-ink px-1 text-[11px] font-semibold text-white">
          {l.quantity}
        </span>
      </Link>
      <div className="min-w-0 text-[14.5px] leading-snug">
        <p className="font-medium text-ink">{l.product.name}</p>
        {l.variantLabel && <p className="text-muted">{l.variantLabel}</p>}
      </div>
      <p className="text-[14.5px] font-medium text-ink tabular-nums">{formatMoney({ ...l.unit, amount: l.unit.amount * l.quantity })}</p>
    </li>
  )
}

function Fieldset({ title, n, children }: { title: string; n: string; children: ReactNode }) {
  return (
    <fieldset className="mt-10 border-t border-mist-2 pt-6">
      <legend className="float-left mb-5 flex w-full items-center gap-3 text-[18px] font-medium tracking-[-0.015em] text-ink">
        <span className="font-mono text-[12px] tracking-[0.08em] text-cyan-700">{n}</span>
        {title}
      </legend>
      <div className="clear-both space-y-4">{children}</div>
    </fieldset>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  children: React.ReactElement<Record<string, unknown>>
}) {
  const described = [hint && `h-${id}`, error && `e-${id}`].filter(Boolean).join(' ') || undefined
  const control = cloneElement(children, {
    'aria-invalid': !!error,
    'aria-describedby': described,
    className: `field ${error ? 'field-error' : ''}`,
  })
  return (
    <div>
      <label htmlFor={`f-${id}`} className="mb-1.5 block text-[14px] font-medium text-ink">
        {label} {optional && <span className="font-normal text-muted">(opțional)</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={`h-${id}`} className="mt-1.5 text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`e-${id}`} className="mt-1.5 text-[13.5px] text-red-deep">
          {error}
        </p>
      )}
    </div>
  )
}
