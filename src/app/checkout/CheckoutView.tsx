'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { cloneElement, useEffect, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'
import { useCart, type ResolvedLine } from '@/components/cart/CartProvider'
import { Arrow, Bank, CardIcon, Lock, Mail } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { site, terms } from '@/config/site'
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
  TRANSFER_KEY,
} from '@/lib/checkout'
import { formatLei } from '@/lib/money'
import { Price } from '@/components/cart/Price'

/** Field order on screen, so the first error is focused first. */
const ORDER: FieldName[] = [
  'name',
  'email',
  'phone',
  'company',
  'cui',
  'regCom',
  'address',
  'city',
  'county',
  'postalCode',
  'shipAddress',
  'shipCity',
  'shipCounty',
  'shipPostalCode',
  'notes',
  'paymentMethod',
  'acceptedTerms',
]

type Methods = Record<PaymentMethod, boolean>

const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

export function CheckoutView({ methods }: { methods: Methods }) {
  const hydrated = useHydrated()
  const { lines } = useCart()

  if (!hydrated) return <div className="min-h-[60vh]" aria-busy="true" />
  if (lines.length === 0) return <EmptyCheckout />
  return <CheckoutForm lines={lines} methods={methods} />
}

function EmptyCheckout() {
  return (
    <div className="max-w-[40em] py-6">
      <h1 className="text-[36px] tracking-[-0.035em] max-sm:text-[30px]">Coșul tău este gol.</h1>
      <p className="sub mt-3">Adaugă un produs în coș ca să poți finaliza comanda.</p>
      <ul className="mt-8 grid gap-2">
        {products.map((p) => (
          <li key={p.id}>
            <Link
              href={productHref(p)}
              className="group grid grid-cols-[88px_1fr_auto] items-center gap-4 rounded-[16px] bg-paper p-3 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-line)]"
            >
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
  // Start on a method that works; card first when both do.
  if (!methods[draft.paymentMethod]) draft = { ...draft, paymentMethod: methods.card || !methods.transfer ? 'card' : 'transfer' }
  return draft
}

function CheckoutForm({ lines, methods }: { lines: ResolvedLine[]; methods: Methods }) {
  const router = useRouter()
  const cancelled = useSearchParams().get('anulat') === '1'
  const { total, open: openCart } = useCart()
  const anyMethod = methods.card || methods.transfer

  const [form, setForm] = useState<OrderForm>(() => readDraft(methods))
  const [accepted, setAccepted] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [attemptId] = useState(() => crypto.randomUUID())

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    } catch {}
  }, [form])

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
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: lines.map((l) => ({ productId: l.product.id, variantId: l.variant?.id, quantity: l.quantity })),
          order: form,
          acceptedTerms: accepted,
          attemptId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.method === 'card' && data.url) {
        window.location.assign(data.url)
        return
      }
      if (res.ok && data.method === 'transfer') {
        try {
          sessionStorage.setItem(TRANSFER_KEY, JSON.stringify({ ...data, lines: lines.map(summaryOf) }))
        } catch {}
        router.push('/checkout/transfer')
        return
      }
      setServerError(data.message ?? 'Ceva nu a funcționat. Încearcă din nou.')
    } catch {
      setServerError('Nu ne-am putut conecta. Verifică internetul și încearcă din nou. Nu ți s-a retras nimic.')
    }
    setSending(false)
  }

  const mailtoOrder = `mailto:${site.email}?subject=${encodeURIComponent('Comandă de pe site')}&body=${encodeURIComponent(
    `Bună ziua,\n\nAș dori să comand:\n${lines.map((l) => `- ${l.quantity} x ${l.product.name}${l.variantLabel ? ` (${l.variantLabel})` : ''}`).join('\n')}\n\nMulțumesc!`,
  )}`

  return (
    <form onSubmit={submit} noValidate aria-busy={sending}>
      <h1 className="text-[clamp(30px,3.4vw,40px)] leading-tight tracking-[-0.035em]">Finalizează comanda</h1>

      {cancelled && (
        <p role="status" className="mt-5 max-w-[46em] rounded-[14px] bg-paper px-5 py-4 text-[15.5px] text-ink">
          Plata a fost anulată și nu ți s-a retras nimic. Produsele sunt tot în coș.
        </p>
      )}

      {/* Phones: the order, folded, above the form */}
      <details className="faq group mt-5 rounded-[16px] bg-paper md:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 [&::-webkit-details-marker]:hidden">
          <span className="text-[15.5px] font-medium text-ink">
            Comanda ta <span className="font-normal text-muted">({lines.reduce((n, l) => n + l.quantity, 0)})</span>
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

      <div className="mt-6 grid gap-y-8 md:mt-8 md:grid-cols-12 md:gap-x-8 lg:gap-x-12">
        {!anyMethod ? (
          <div className="md:col-span-7">
            <div className="rounded-[20px] bg-paper p-6 max-sm:px-5">
              <h2 className="text-[22px] tracking-[-0.02em]">Comenzile online se activează în curând.</h2>
              <p className="mt-3 max-w-[34em] text-[16px] leading-relaxed text-text">
                Până atunci, comanzi direct la noi: scrie-ne sau sună-ne și confirmăm împreună produsele, livrarea și plata. Îți răspundem {terms.responseTime}.
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
              <Field name="name" label="Nume și prenume" error={show('name')}>
                <input autoComplete="name" {...bind('name')} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="email" label="Email" hint="Aici primești confirmarea." error={show('email')}>
                  <input type="email" inputMode="email" autoComplete="email" {...bind('email')} />
                </Field>
                <Field name="phone" label="Telefon" hint="Pentru curier." error={show('phone')}>
                  <input type="tel" inputMode="tel" autoComplete="tel" {...bind('phone')} />
                </Field>
              </div>
            </Group>

            <Group n={2} title="Date de facturare">
              <div role="radiogroup" aria-label="Tip client" className="grid grid-cols-2 gap-1 rounded-[12px] bg-mist p-1">
                {(
                  [
                    ['pf', 'Persoană fizică'],
                    ['pj', 'Persoană juridică'],
                  ] as const
                ).map(([v, label]) => (
                  <label
                    key={v}
                    className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[9px] px-3 text-center text-[15px] font-medium transition-[background-color,box-shadow] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan ${
                      form.buyerType === v ? 'bg-paper text-ink shadow-[0_1px_3px_rgba(8,17,19,.12)]' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <input
                      type="radio"
                      name="buyerType"
                      value={v}
                      checked={form.buyerType === v}
                      onChange={() => patch({ buyerType: v })}
                      className="sr-only"
                    />
                    {label}
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

              <Field
                name="address"
                label={pj ? 'Adresa sediului' : 'Adresa'}
                hint={pj ? undefined : 'Stradă, număr, bloc, apartament.'}
                error={show('address')}
              >
                <input autoComplete={pj ? 'off' : 'street-address'} {...bind('address')} />
              </Field>
              <AddressLine prefix="" bind={bind} show={show} autoComplete={!pj} />
            </Group>

            <Group n={3} title="Livrare">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15.5px] text-ink">
                <input
                  type="checkbox"
                  checked={form.sameAddress}
                  onChange={(e) => patch({ sameAddress: e.target.checked })}
                  className="h-5 w-5 flex-none accent-[var(--color-ink)]"
                />
                {pj ? 'Livrează la adresa sediului' : 'Livrează la aceeași adresă'}
              </label>
              {!form.sameAddress && (
                <>
                  <Field name="shipAddress" label="Adresa de livrare" hint="Stradă, număr, bloc, apartament." error={show('shipAddress')}>
                    <input autoComplete="shipping street-address" {...bind('shipAddress')} />
                  </Field>
                  <AddressLine prefix="ship" bind={bind} show={show} autoComplete />
                </>
              )}
              <Field name="notes" label="Observații pentru curier" optional>
                <textarea rows={2} {...bind('notes')} />
              </Field>
              <p className="text-[14.5px] text-text">Livrare gratuită prin curier, oriunde în România.</p>
            </Group>

            <Group n={4} title="Plată">
              <div role="radiogroup" aria-label="Metoda de plată" className="grid gap-2">
                <PayOption
                  id="card"
                  icon={<CardIcon className="h-6 w-6" />}
                  title="Card bancar"
                  text="Plătești acum, pe pagina securizată Stripe."
                  available={methods.card}
                  checked={form.paymentMethod === 'card'}
                  onSelect={() => patch({ paymentMethod: 'card' })}
                />
                <PayOption
                  id="transfer"
                  icon={<Bank className="h-6 w-6" />}
                  title="Transfer bancar"
                  text="Primești datele pentru plată imediat după comandă. Trimitem coletul după ce primim plata."
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
              <button
                type="button"
                onClick={openCart}
                className="-mr-2 min-h-11 rounded px-2 text-[15px] text-muted underline underline-offset-4 hover:text-ink"
              >
                Modifică
              </button>
            </div>

            <ul className="mt-2 divide-y divide-mist-2 border-y border-mist-2 max-md:hidden">
              {lines.map((l) => (
                <SummaryLine key={l.key} line={l} />
              ))}
            </ul>

            <dl className="mt-4 space-y-1.5 text-[15.5px]">
              <div className="flex justify-between">
                <dt className="text-muted">Livrare</dt>
                <dd className="text-ink">Gratuită</dd>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="text-[26px] font-medium tracking-[-0.02em] text-ink tabular-nums">{formatLei(total)}</dd>
              </div>
            </dl>
            <p className="text-right text-[13px] text-muted">{terms.vat}</p>

            {anyMethod && (
              <>
                <div className="mt-5 border-t border-mist-2 pt-5">
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

                {submitted && Object.keys(errors).length > 0 && !serverError && (
                  <p role="alert" className="mt-4 text-[14.5px] text-red-deep">
                    Completează câmpurile marcate cu roșu.
                  </p>
                )}
                {serverError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-[12px] bg-paper px-4 py-3 text-[14.5px] leading-snug text-ink shadow-[inset_0_0_0_1px_var(--color-red)]"
                  >
                    {serverError}
                  </p>
                )}

                <button type="submit" disabled={sending} className="cta mt-5 w-full disabled:cursor-wait disabled:opacity-80">
                  {sending ? (
                    <>
                      <span aria-hidden className="spinner" /> Se trimite comanda…
                    </>
                  ) : form.paymentMethod === 'card' ? (
                    <>
                      <Lock /> Plătește {formatLei(total)}
                    </>
                  ) : (
                    <>Plasează comanda</>
                  )}
                </button>
                <p className="mt-3 text-center text-[14px] leading-snug text-text">
                  {form.paymentMethod === 'card'
                    ? 'Te ducem pe pagina securizată Stripe. Datele cardului nu trec prin site-ul nostru.'
                    : 'Comanda se înregistrează ca „în așteptarea plății”. Pe pagina următoare găsești datele pentru transfer.'}
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </form>
  )
}

const summaryOf = (l: ResolvedLine) => ({ name: l.product.name, variant: l.variantLabel, quantity: l.quantity, total: l.unit * l.quantity })

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
  const ac = (v: string) => (autoComplete ? `${prefix ? 'shipping ' : ''}${v}` : 'off')
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
}: {
  id: PaymentMethod
  icon: ReactNode
  title: string
  text: string
  available: boolean
  checked: boolean
  onSelect: () => void
}) {
  const on = checked && available
  return (
    <label
      className={`flex items-start gap-4 rounded-[14px] p-4 transition-shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cyan ${
        available ? 'cursor-pointer bg-paper' : 'cursor-not-allowed bg-mist'
      } ${on ? 'shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)]'}`}
    >
      <input id={`pm-${id}`} type="radio" name="paymentMethod" value={id} checked={on} disabled={!available} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full ${on ? 'bg-ink' : 'bg-paper shadow-[inset_0_0_0_1.5px_var(--color-faint)]'}`}
      >
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
  )
}

function Thumb({ image, className = '' }: { image: ResolvedLine['product']['cutout']; className?: string }) {
  return (
    <span className={`relative block flex-none overflow-hidden rounded-[10px] ${className}`}>
      <Image
        src={image.src}
        alt=""
        fill
        sizes="96px"
        className={image.kind === 'photo' ? 'object-cover' : `object-contain p-1.5 ${image.bleed === 'bottom' ? 'object-bottom pb-0' : ''}`}
      />
    </span>
  )
}

function SummaryLine({ line: l }: { line: ResolvedLine }) {
  return (
    <li className="grid grid-cols-[72px_1fr_auto] items-center gap-3.5 py-3.5">
      <span className="relative">
        <Thumb image={l.variant?.images[0] ?? l.product.cutout} className="h-14 w-[72px] bg-mist" />
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
