'use client'

import { maxQtyFor } from '@/lib/purchase'
import Link from '@/components/ui/Link'
import { useSearchParams } from 'next/navigation'
import { cloneElement, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'
import { useCart, type ResolvedLine } from '@/components/cart/CartProvider'
import { cartStore } from '@/components/cart/cart-store'
import { CarryLink } from '@/components/cart/CarryLink'
import { Price } from '@/components/cart/Price'
import { Thumb } from '@/components/cart/Thumb'
import { LineBundle } from '@/components/cart/LineBundle'
import { QuantityStepper } from '@/components/cart/QuantityStepper'
import { Suggestions } from '@/components/offers/Suggestions'
import { Totals } from '@/components/cart/Totals'
import { Arrow, Bank, CardIcon, Lock, Mail, Truck } from '@/components/ui/icons'
import { productHref, productsIn, resolveLine, variantLabel } from '@/content/catalog'
import { useLocale } from '@/i18n/LocaleProvider'
import { ui } from '@/i18n/ui'
import type { Locale } from '@/i18n/locales'
import { attributionParams } from '@/lib/attribution'
import { consentStore } from '@/lib/consent/store'
import { cookieFrom, normalizeContact, PROMO_COOKIE, validateContact } from '@/lib/lead'
import { cashOnDelivery } from '@/config/payments'
import { site, terms } from '@/config/site'
import { itemOf, track } from '@/lib/analytics'
import { CommunicationsConsent } from '@/components/consent/CommunicationsConsent'
import { priceLines, type PromoCodeRule } from '@/lib/promotions'
import { shippingFor } from '@/lib/shipping'
import {
  COUNTIES,
  DRAFT_KEY,
  deliveryCountry,
  emptyOrder,
  normalizeOrder,
  validateOrder,
  type FieldName,
  type OrderFields,
  type OrderForm,
  type PaymentMethod,
} from '@/lib/checkout'
import { useMoney } from '@/i18n/currency'
import { cardOnly, rateFor } from '@/lib/currency'
import { countryOptions, isCountry } from '@/lib/countries'
import { localePath } from '@/i18n/locales'
import { onIntlSite } from '@/lib/sites'
import { isLandingSlug } from '@/lib/landing-hosts'
import { parseItems } from '@/lib/purchase'
import { CardPayment, type CardApi } from './CardPayment'

/** Field order on screen, so the first error is focused first. */
const ORDER: FieldName[] = [
  'firstName', 'lastName', 'email', 'phone', 'company', 'cui', 'regCom', 'address', 'city', 'county', 'postalCode',
  'shipAddress', 'shipCity', 'shipCounty', 'shipPostalCode', 'notes', 'paymentMethod', 'acceptedTerms',
]

type Methods = Record<PaymentMethod, boolean>

const COPY = {
  ro: {
    emptyTitle: 'Coșul tău este gol.',
    emptyText: 'Adaugă un produs în coș ca să poți finaliza comanda.',
    cardLoading: 'Plata cu cardul se încarcă. Încearcă din nou într-o clipă.',
    failed: 'Ceva nu a funcționat. Încearcă din nou.',
    promoLabel: 'Ai un cod promoțional?',
    promoPlaceholder: 'Cod promoțional',
    promoApply: 'Aplică',
    promoApplying: 'Se verifică…',
    promoRemove: 'Elimină',
    promoApplied: (code: string) => `Codul ${code} este aplicat.`,
    offline: 'Nu ne-am putut conecta. Verifică internetul și încearcă din nou.',
    title: 'Finalizează comanda',
    yourOrder: 'Comanda ta',
    soonTitle: 'Comenzile online se activează în curând.',
    soonText: `Până atunci, comanzi direct la noi. Scrie-ne sau sună-ne și confirmăm împreună produsele, livrarea și plata. Îți răspundem ${terms.responseTime}.`,
    orderByEmail: 'Comandă pe email',
    call: `Sună la ${site.phone}`,
    emailPrefilled: 'Emailul se deschide cu produsele din coș deja scrise.',
    contact: 'Date de contact',
    firstName: 'Prenume',
    lastName: 'Nume',
    email: 'Email',
    emailHint: 'Aici primești confirmarea comenzii.',
    phone: 'Telefon',
    phoneHint: 'Pentru curier.',
    billing: 'Facturare',
    billTo: 'Facturez pe',
    person: ['Persoană fizică', 'Pe numele tău'] as [string, string],
    company: ['Persoană juridică', 'Pe firmă'] as [string, string],
    companyName: 'Denumirea firmei',
    cui: 'Cod fiscal (CUI)',
    cuiHint: 'Cu sau fără RO.',
    vatId: 'Cod TVA / nr. înregistrare',
    vatHint: 'Pentru firmele din afara României.',
    countryLabel: 'Țara',
    region: 'Regiune / stat',
    cardOnlyNote: 'Doar în România, în lei',
    regCom: 'Nr. Registrul Comerțului',
    office: 'Adresa sediului',
    address: 'Adresa',
    addressHint: 'Stradă, număr, bloc, scară, apartament.',
    delivery: 'Livrare',
    sameAddress: 'Adresa de livrare este aceeași cu adresa de facturare',
    shipAddress: 'Adresa de livrare',
    notes: 'Observații pentru curier',
    freeDelivery: 'Livrare gratuită prin curier, oriunde în lume.',
    bookDelivery: 'Livrare prin curier. Comanda conține cartea, așa că livrarea se plătește o singură dată, oricâte produse ai în coș. Suma este în rezumatul comenzii.',
    payment: 'Plată',
    method: 'Metoda de plată',
    card: 'Card bancar',
    cardText: 'Plătești acum. Datele cardului merg direct la Stripe, procesatorul nostru de plăți.',
    cardNote: 'După plată îți putem propune un produs opțional. Îl adaugi doar dacă vrei, cu o nouă confirmare. Stripe păstrează cardul pentru această comandă 30 de minute. Noi nu vedem și nu stocăm datele cardului.',
    transfer: 'Transfer bancar',
    transferText: 'Primești datele pentru plată imediat după comandă. Pregătim coletul după ce primim plata.',
    cod: 'Ramburs (plata la livrare)',
    codText: 'Plătești curierului când primești coletul. Nu plătești nimic acum.',
    codAfter: (amount: string) => `Comanda se confirmă imediat. Plătești ${amount} curierului când primești coletul.`,
    edit: 'Modifică',
    quantityOf: (name: string) => `Cantitate ${name}`,
    remove: 'Elimină',
    removeOf: (name: string) => `Elimină ${name} din comandă`,
    accept: 'Accept',
    terms: 'Termenii și Condițiile',
    optional: '(opțional)',
    dataUse: 'Folosim datele tale ca să procesăm, să facturăm și să livrăm comanda. Detalii în',
    privacy: 'politica de confidențialitate',
    fixFields: 'Completează câmpurile marcate cu roșu.',
    paying: 'Se procesează plata…',
    sending: 'Se trimite comanda…',
    pay: (amount: string) => `Plătește ${amount}`,
    // OUG 34/2014 art. 8(2): the button says the order implies an obligation to pay.
    placeOrder: 'Comandă cu obligație de plată',
    cardAfter: 'Plata se face în siguranță prin Stripe. După plată primești confirmarea pe email.',
    transferAfter: 'Comanda se înregistrează imediat. Datele pentru transfer apar pe pagina următoare și în email.',
    withdrawal: `Drept de retragere ${terms.returnDays} zile`,
    warranty: `garanție legală de conformitate ${terms.warrantyYears} ani`,
    city: 'Localitate',
    county: 'Județ',
    choose: 'Alege',
    postalCode: 'Cod poștal',
    soon: 'În curând',
    perUnit: 'buc.',
    mailSubject: 'Comandă de pe site',
    mailBody: (items: string) => `Bună ziua,\n\nAș dori să comand:\n${items}\n\nMulțumesc!`,
  },
  en: {
    emptyTitle: 'Your cart is empty.',
    emptyText: 'Add a product to your cart to check out.',
    cardLoading: 'The card payment is still loading. Try again in a moment.',
    failed: 'Something went wrong. Please try again.',
    promoLabel: 'Have a promo code?',
    promoPlaceholder: 'Promo code',
    promoApply: 'Apply',
    promoApplying: 'Checking…',
    promoRemove: 'Remove',
    promoApplied: (code: string) => `Code ${code} is applied.`,
    offline: 'We could not connect. Check your internet connection and try again.',
    title: 'Check out',
    yourOrder: 'Your order',
    soonTitle: 'Online orders open soon.',
    soonText: 'Until then, you can order directly from us. Write or call us and we will confirm the products, delivery and payment together. We reply within 24 hours.',
    orderByEmail: 'Order by email',
    call: `Call ${site.phone}`,
    emailPrefilled: 'The email opens with the products from your cart already listed.',
    contact: 'Contact details',
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    emailHint: 'Your order confirmation goes here.',
    phone: 'Phone',
    phoneHint: 'For the courier.',
    billing: 'Billing',
    billTo: 'Invoice to',
    person: ['Individual', 'In your name'] as [string, string],
    company: ['Company', 'In the company name'] as [string, string],
    companyName: 'Company name',
    cui: 'Tax code (CUI)',
    cuiHint: 'With or without RO.',
    vatId: 'VAT / registration number',
    vatHint: 'For companies outside Romania.',
    countryLabel: 'Country',
    region: 'Region / state',
    cardOnlyNote: 'Romania only, in lei',
    regCom: 'Trade Register number',
    office: 'Registered office address',
    address: 'Address',
    addressHint: 'Street, number, building, entrance, flat.',
    delivery: 'Delivery',
    sameAddress: 'Deliver to my billing address',
    shipAddress: 'Delivery address',
    notes: 'Notes for the courier',
    freeDelivery: 'Free courier delivery, worldwide.',
    bookDelivery: 'Courier delivery. Your order includes the book, so one delivery fee applies, however many products are in your cart. The amount is in your order summary.',
    payment: 'Payment',
    method: 'Payment method',
    card: 'Card',
    cardText: 'Pay now. Your card details go straight to Stripe, our payment processor.',
    cardNote: 'After payment we may suggest an optional product. You add it only if you want, with a new confirmation. Stripe keeps the card for this order for 30 minutes. We never see or store your card details.',
    transfer: 'Bank transfer',
    transferText: 'You get the payment details right after you order. We pack your order once the payment arrives.',
    cod: 'Cash on delivery',
    codText: 'You pay the courier when the parcel arrives. Nothing to pay now.',
    codAfter: (amount: string) => `Your order is confirmed right away. You pay ${amount} to the courier when the parcel arrives.`,
    edit: 'Edit',
    quantityOf: (name: string) => `Quantity of ${name}`,
    remove: 'Remove',
    removeOf: (name: string) => `Remove ${name} from the order`,
    accept: 'I accept the',
    terms: 'Terms and Conditions',
    optional: '(optional)',
    dataUse: 'We use your details to process, invoice and deliver your order. Read more in our',
    privacy: 'privacy policy',
    fixFields: 'Please fill in the fields marked in red.',
    paying: 'Processing payment…',
    sending: 'Placing your order…',
    pay: (amount: string) => `Pay ${amount}`,
    placeOrder: 'Order with obligation to pay',
    cardAfter: 'Payment is handled securely by Stripe. You get the confirmation by email.',
    transferAfter: 'Your order is recorded right away. The transfer details appear on the next page and in your email.',
    withdrawal: `${terms.returnDays}-day right of withdrawal`,
    warranty: `${terms.warrantyYears}-year legal guarantee of conformity`,
    city: 'Town or city',
    county: 'County',
    choose: 'Choose',
    postalCode: 'Postcode',
    soon: 'Coming soon',
    perUnit: 'each',
    mailSubject: 'Order from the website',
    mailBody: (items: string) => `Hello,\n\nI would like to order:\n${items}\n\nThank you!`,
  },
}
type Copy = (typeof COPY)['ro']
const useCopy = (): Copy => COPY[useLocale()]

const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

/**
 * Direct checkout: /checkout?item=<productId>[:<variantId>][*<quantity>] (repeatable; `lib/purchase.ts`).
 * The landing already put its selection in the cart before navigating; the URL carries the same
 * selection so the link also works on its own (new tab, shared link, reload). The items are read
 * from the router's search params, never from window.location during render: on a client-side
 * navigation window.location still holds the previous page's URL at that point (the bug that
 * emptied the checkout coming from a landing). Unknown or unpriced ids are ignored; the server
 * prices the order again.
 */
export function CheckoutView({ methods, stripeKey }: { methods: Methods; stripeKey: string | null }) {
  const hydrated = useHydrated()
  const { lines } = useCart()
  const params = useSearchParams()
  const items = params.getAll('item').join('&')
  const lp = params.get('lp')
  // ?plata=ramburs|card|transfer: the button the customer pressed on the product page.
  const [preferred] = useState(() => PREFERRED[params.get('plata') ?? ''])

  // Makes sure the linked selection is in the cart (never twice), then drops ?item so a reload or a
  // return to this page changes nothing. The campaign parameters stay until the order is placed.
  useEffect(() => {
    if (!items) return
    const direct = parseItems(new URLSearchParams(items.split('&').map((i) => ['item', i])), isLandingSlug(lp) ? 'landing' : 'link')
    if (direct.length) {
      cartStore.restore(direct)
      // A "buy now" button (landing or product page) adds to the cart here: AddToCart once per link (?item is
      // dropped below, so a reload does not repeat it).
      const added = direct.flatMap((d) => {
        const r = resolveLine(d.productId, d.variantId)
        return r && r.unit !== null ? [{ value: r.unit * d.quantity, item: itemOf(r.product, r.variant, r.variant && variantLabel(r.product, r.variant), d.quantity) }] : []
      })
      if (added.length) track('add_to_cart', { value: added.reduce((n, a) => n + a.value, 0), items: added.map((a) => a.item) })
    }
    const url = new URL(window.location.href)
    url.searchParams.delete('item')
    url.searchParams.delete('plata')
    window.history.replaceState(window.history.state, '', url)
  }, [items, lp])

  if (!hydrated || (items && lines.length === 0)) return <div className="min-h-[60vh]" aria-busy="true" />
  if (lines.length === 0) return <EmptyCheckout />
  return <CheckoutForm lines={lines} methods={{ card: methods.card && !!stripeKey, transfer: methods.transfer, cod: methods.cod }} stripeKey={stripeKey} preferred={preferred} />
}

function EmptyCheckout() {
  const locale = useLocale()
  const t = COPY[locale]
  return (
    <div className="max-w-[40em] py-6">
      <h1 className="text-[36px] tracking-[-0.035em] max-sm:text-[30px]">{t.emptyTitle}</h1>
      <p className="sub mt-3">{t.emptyText}</p>
      <ul className="mt-8 grid gap-2">
        {productsIn(locale).map((p) => (
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

const PREFERRED: Record<string, PaymentMethod | undefined> = { ramburs: 'cod', card: 'card', transfer: 'transfer' }

function readDraft(methods: Methods, preferred?: PaymentMethod, locale: Locale = 'ro'): OrderForm {
  let draft = emptyOrder
  let stored = false
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    stored = !!raw
    draft = normalizeOrder(JSON.parse(raw ?? '{}'))
  } catch {}
  // A first visit in English: the country of the browser's language region (de-DE → Germany), else Romania.
  if (!stored && locale === 'en') {
    const region = (navigator.language.split('-')[1] ?? '').toUpperCase()
    if (isCountry(region)) draft = { ...draft, country: region, shipCountry: region }
  }
  if (preferred && methods[preferred]) draft = { ...draft, paymentMethod: preferred }
  if (!methods[draft.paymentMethod]) draft = { ...draft, paymentMethod: methods.card ? 'card' : methods.cod ? 'cod' : 'transfer' }
  return draft
}

function CheckoutForm({ lines, methods: offered, stripeKey, preferred }: { lines: ResolvedLine[]; methods: Methods; stripeKey: string | null; preferred?: PaymentMethod }) {
  const locale: Locale = useLocale()
  const t = COPY[locale]
  const { pricing: cartPricing, currency } = useCart()
  const money = useMoney()
  // The international site has no AI calls: its communications box names email only.
  const [intl] = useState(onIntlSite)
  // A promo code checked by the server (/api/promo): its rule prices the cart here exactly as the order will.
  // A code brought by a recovery link (cookie set by /api/lead/resume) is shown in the field; the customer applies it.
  const [promo, setPromo] = useState<{ input: string; rule: PromoCodeRule | null; error: string | null; busy: boolean; open: boolean }>(() => {
    const brought = typeof document === 'undefined' ? undefined : cookieFrom(document.cookie, PROMO_COOKIE)
    const code = brought && /^[A-Z0-9]{4,32}$/.test(brought) ? brought : ''
    return { input: code, rule: null, error: null, busy: false, open: !!code }
  })
  const priced = useMemo(() => lines.map((l) => ({ key: l.key, productId: l.product.id, variantId: l.variant?.id, quantity: l.quantity, unitAmount: l.unit })), [lines])
  const withCode = useMemo(() => (promo.rule ? priceLines(priced, undefined, money.rule(promo.rule)) : null), [priced, promo.rule, money])
  // A cart change can make an applied code stop fitting (minimum, products): the totals fall back, and the order says why.
  const pricing = withCode && !withCode.code?.problem ? withCode : cartPricing
  // Free, or the book's flat fee once per order (lib/shipping.ts): never discounted, added after the promotions.
  // A gift code (a reward: the product is free) pays its delivery, as the server charges it.
  const gift = !!(withCode && !withCode.code?.problem && promo.rule?.freeUnits && withCode.code?.amountMinor)
  const shipping = useMemo(() => shippingFor(priced, currency, undefined, { gift }), [priced, currency, gift])
  const total = pricing.totalMinor + shipping
  // What analytics receive is always in lei (like the item prices and the Purchase): an order in euro or dollars at its rate.
  const totalLei = currency === 'RON' ? total : Math.round(total * rateFor(currency))
  // The summary stays in view only when it fits the window; a taller one scrolls with the page, so its lower part
  // (consents, the pay button) is never out of reach.
  const summaryRef = useRef<HTMLDivElement>(null)
  const summaryFits = useFitsWindow(summaryRef)
  const [form, setForm] = useState<OrderForm>(() => readDraft(offered, preferred, locale))
  // Euro, dollar or a parcel abroad: the card only (cash on delivery and bank transfer are for lei in Romania).
  const cardOnlyHere = cardOnly(currency, deliveryCountry(form))
  const methods: Methods = useMemo(() => (cardOnlyHere ? { card: offered.card, transfer: false, cod: false } : offered), [cardOnlyHere, offered])
  // The form stays as long as something can be paid here at all (a country change can bring the other methods back).
  const anyMethod = offered.card || offered.transfer || offered.cod
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!methods[form.paymentMethod] && methods.card) setForm((o) => ({ ...o, paymentMethod: 'card' }))
  }, [methods, form.paymentMethod])
  const [accepted, setAccepted] = useState(false)
  // The one communications box (form.marketingConsent) names email and AI calls on biohack-tech.ro (the checkout
  // lead records both); on the international site it names email only.
  const callConsent = form.marketingConsent && !intl
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [serverFields, setServerFields] = useState<Partial<Record<FieldName, string>>>({})
  const [attemptId] = useState(() => crypto.randomUUID())
  const card = useRef<CardApi | null>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    } catch {}
  }, [form])

  useEffect(() => {
    track('begin_checkout', { value: totalLei, items: lines })
    // Once per visit of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Progressive capture: once the contact step identifies the visitor (a valid email, plus a name or a phone),
  // what they typed and the cart are saved as a checkout lead, so an abandoned checkout can be followed up
  // (only with marketing consent). Debounced; the same content is never sent twice. Off unless
  // ABANDONED_CHECKOUT_ENABLED (the server answers "skipped").
  const contactKey = JSON.stringify([`${form.firstName} ${form.lastName}`.trim(), form.email.trim(), form.phone.trim(), form.marketingConsent, callConsent, lines.map((l) => [l.product.id, l.variant?.id, l.quantity])])
  const sentKey = useRef('')
  useEffect(() => {
    const [name, email, phone] = JSON.parse(contactKey) as [string, string, string]
    const contact = normalizeContact({ name, email, phone })
    const bad = validateContact(contact, ['email'])
    if (bad.email || !contact.email || (!contact.name && !contact.phone) || (contact.phone && bad.phone) || contactKey === sentKey.current) return
    const timer = setTimeout(() => {
      sentKey.current = contactKey
      void fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          action: 'checkout',
          locale,
          ...contact,
          marketingConsent: form.marketingConsent,
          callConsent,
          cart: lines.map((l) => ({ productId: l.product.id, variantId: l.variant?.id, quantity: l.quantity })),
          attribution: Object.fromEntries(attributionParams(window.location.search)),
        }),
      }).catch(() => {
        sentKey.current = ''
      })
    }, 1500)
    return () => clearTimeout(timer)
    // contactKey carries every input of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactKey])

  const errors = validateOrder(form, accepted, methods, locale)
  const show = (f: FieldName) => (submitted || touched[f] ? errors[f] : undefined) ?? serverFields[f]
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
    setServerFields({})
    const first = ORDER.find((f) => errors[f])
    if (first) {
      document.getElementById(first === 'paymentMethod' ? `pm-${form.paymentMethod}` : `f-${first}`)?.focus()
      return
    }
    setSending(true)
    try {
      // Card: Stripe checks the card fields first, so an incomplete card never creates an order.
      if (form.paymentMethod === 'card') {
        if (!card.current) throw new Error(t.cardLoading)
        const problem = await card.current.validate()
        if (problem) throw new Error(problem)
      }
      track('add_payment_info', { value: totalLei, items: lines, payment_type: form.paymentMethod === 'card' ? 'card' : form.paymentMethod === 'cod' ? 'ramburs' : 'transfer bancar' })

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: lines.map((l) => ({ productId: l.product.id, variantId: l.variant?.id, quantity: l.quantity })),
          order: form,
          acceptedTerms: accepted,
          locale,
          currency,
          ...(promo.rule && { promoCode: promo.rule.code }),
          attemptId,
          // Landing and UTM parameters from the URL, if any, and where the first product was added.
          // The server validates them.
          attribution: { ...Object.fromEntries(attributionParams(window.location.search)), ...(lines[0]?.source && { entry: lines[0].source }) },
          // The cookie banner's marketing choice: the server sends Meta this order's Purchase only with it.
          cookieMarketing: consentStore.allows('marketing'),
        }),
      })
      const data = await res.json().catch(() => ({}))
      // Fields the server rejected (rare: client and server checks agree) are marked like the client's own.
      if (res.status === 422 && data.error === 'PROMO') {
        // The code stopped being usable since it was applied (expired, used up, cart changed): said at the code.
        setPromo((p) => ({ ...p, rule: null, error: data.message ?? t.failed, open: true }))
        document.getElementById('f-promo')?.focus()
      } else if (res.status === 422 && data.fields && typeof data.fields === 'object') {
        setServerFields(data.fields as Partial<Record<FieldName, string>>)
        const first = ORDER.find((f) => (data.fields as Record<string, string>)[f])
        if (first) document.getElementById(first === 'paymentMethod' ? `pm-${form.paymentMethod}` : `f-${first}`)?.focus()
      }
      // The server answers in the checkout's language (it gets `locale`).
      if (!res.ok) throw new Error(data.message ?? t.failed)

      // The order link carries its token: a full page load lets the server move it into a cookie and open the
      // order at /comanda, before any analytics or ad tool can read the address (lib/private-links.ts).
      const orderUrl = localePath(locale, `/comanda/${data.token}`)
      if (data.method === 'transfer' || data.method === 'cod' || data.paid || data.submitted) {
        window.location.assign(orderUrl)
        return
      }
      // Stripe confirms the payment. Redirect methods leave for the order page; a card that finishes here
      // does not, so we open it ourselves. Purchase is sent from that page once the payment is paid.
      const failure = await card.current!.confirm(data.clientSecret, `${window.location.origin}${orderUrl}`, {
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        phone: form.phone,
        address: { line1: form.address, city: form.city, state: form.county, postal_code: form.postalCode, country: form.country },
      })
      if (failure) throw new Error(failure)
      window.location.assign(orderUrl)
    } catch (err) {
      setServerError(err instanceof Error && err.message ? err.message : t.offline)
      setSending(false)
    }
  }

  const mailtoOrder = `mailto:${site.email}?subject=${encodeURIComponent(t.mailSubject)}&body=${encodeURIComponent(
    t.mailBody(lines.map((l) => `- ${l.quantity} x ${l.product.name}${l.variantLabel ? ` (${l.variantLabel})` : ''}`).join('\n')),
  )}`
  const count = lines.reduce((n, l) => n + l.quantity, 0)

  return (
    <form onSubmit={submit} noValidate aria-busy={sending}>
      <h1 className="text-[clamp(30px,3.4vw,40px)] leading-tight tracking-[-0.035em]">{t.title}</h1>

      {/* Phones: the order, folded, above the form */}
      <details className="faq group mt-5 rounded-[16px] bg-paper md:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 [&::-webkit-details-marker]:hidden">
          <span className="text-[15.5px] font-medium text-ink">
            {t.yourOrder} <span className="font-normal text-muted">({count})</span>
          </span>
          <span className="flex items-center gap-2 text-[16px] font-medium text-ink tabular-nums">
            {money.fmt(total)} <Arrow className="h-4 w-4 rotate-90 transition-transform group-open:-rotate-90" />
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
              <h2 className="text-[22px] tracking-[-0.02em]">{t.soonTitle}</h2>
              <p className="mt-3 max-w-[34em] text-[16px] leading-relaxed text-text">
                {t.soonText}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={mailtoOrder} className="cta">
                  <Mail /> {t.orderByEmail}
                </a>
                <a href={site.phoneHref} className="btn-secondary">
                  {t.call}
                </a>
              </div>
              <p className="mt-4 text-[14px] text-muted">{t.emailPrefilled}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 md:col-span-7 max-sm:space-y-6">
            <Group n={1} title={t.contact}>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Field name="firstName" label={t.firstName} error={show('firstName')}>
                  <input autoComplete="given-name" {...bind('firstName')} />
                </Field>
                <Field name="lastName" label={t.lastName} error={show('lastName')}>
                  <input autoComplete="family-name" {...bind('lastName')} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="email" label={t.email} hint={t.emailHint} error={show('email')}>
                  <input type="email" inputMode="email" autoComplete="email" spellCheck={false} {...bind('email')} />
                </Field>
                <Field name="phone" label={t.phone} hint={t.phoneHint} error={show('phone')}>
                  <input type="tel" inputMode="tel" autoComplete="tel" {...bind('phone')} />
                </Field>
              </div>
            </Group>

            <Group n={2} title={t.billing}>
              <div role="radiogroup" aria-label={t.billTo} className="grid grid-cols-2 gap-1 rounded-[14px] bg-mist-2 p-1">
                {(
                  [
                    ['pf', ...t.person],
                    ['pj', ...t.company],
                  ] as const
                ).map(([v, label, sub]) => (
                  <label
                    key={v}
                    className={`flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-[11px] px-2 py-2 text-center transition-[background-color,box-shadow] duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cyan ${
                      form.buyerType === v ? 'bg-paper shadow-[0_1px_3px_rgba(8,17,19,.12),0_0_0_1px_rgba(8,17,19,.04)]' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <input type="radio" name="buyerType" value={v} checked={form.buyerType === v} onChange={() => patch({ buyerType: v })} className="sr-only" />
                    <span className={`text-[15px] leading-tight font-semibold ${form.buyerType === v ? 'text-ink' : ''}`}>{label}</span>
                    <span className="mt-0.5 text-[12.5px] text-muted">{sub}</span>
                  </label>
                ))}
              </div>

              {pj && (
                <>
                  <Field name="company" label={t.companyName} error={show('company')}>
                    <input autoComplete="organization" {...bind('company')} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field name="cui" label={form.country === 'RO' ? t.cui : t.vatId} hint={form.country === 'RO' ? t.cuiHint : t.vatHint} error={show('cui')}>
                      <input autoCapitalize="characters" spellCheck={false} {...bind('cui')} />
                    </Field>
                    <Field name="regCom" label={t.regCom} optional>
                      <input spellCheck={false} {...bind('regCom')} />
                    </Field>
                  </div>
                </>
              )}

              <Field name="address" label={pj ? t.office : t.address} hint={t.addressHint} error={show('address')}>
                <input autoComplete={pj ? 'off' : 'billing street-address'} {...bind('address')} />
              </Field>
              <AddressLine prefix="" bind={bind} show={show} autoComplete={!pj} t={t} country={form.country} locale={locale} />
            </Group>

            <Group n={3} title={t.delivery}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15.5px] text-ink">
                <input type="checkbox" checked={form.sameAddress} onChange={(e) => patch({ sameAddress: e.target.checked })} className="h-5 w-5 flex-none accent-[var(--color-ink)]" />
                {t.sameAddress}
              </label>
              {!form.sameAddress && (
                <>
                  <Field name="shipAddress" label={t.shipAddress} hint={t.addressHint} error={show('shipAddress')}>
                    <input autoComplete="shipping street-address" {...bind('shipAddress')} />
                  </Field>
                  <AddressLine prefix="ship" bind={bind} show={show} autoComplete t={t} country={form.shipCountry} locale={locale} />
                </>
              )}
              <Field name="notes" label={t.notes} optional>
                <textarea rows={2} {...bind('notes')} />
              </Field>
              <p className="rounded-[12px] bg-mist px-4 py-3 text-[14.5px] text-text">{shipping ? t.bookDelivery : t.freeDelivery}</p>
            </Group>

            <Group n={4} title={t.payment}>
              <div role="radiogroup" aria-label={t.method} className="grid gap-2">
                {!cardOnlyHere && (offered.cod || cashOnDelivery.enabled) && (
                  <PayOption
                    id="cod"
                    icon={<Truck className="h-6 w-6" />}
                    title={t.cod}
                    text={t.codText}
                    available={methods.cod}
                    checked={form.paymentMethod === 'cod'}
                    onSelect={() => patch({ paymentMethod: 'cod' })}
                  />
                )}
                <PayOption
                  id="card"
                  icon={<CardIcon className="h-6 w-6" />}
                  title={t.card}
                  text={t.cardText}
                  available={methods.card}
                  checked={form.paymentMethod === 'card'}
                  onSelect={() => patch({ paymentMethod: 'card' })}
                >
                  {methods.card && stripeKey && (
                    <div className={form.paymentMethod === 'card' ? 'mt-4' : 'hidden'}>
                      <CardPayment publishableKey={stripeKey} amount={total} currency={currency} apiRef={card} />
                      <p className="mt-3 text-[13px] leading-relaxed text-muted">
                        {t.cardNote}
                      </p>
                    </div>
                  )}
                </PayOption>
                {!cardOnlyHere && (
                <PayOption
                  id="transfer"
                  icon={<Bank className="h-6 w-6" />}
                  title={t.transfer}
                  text={t.transferText}
                  available={methods.transfer}
                  checked={form.paymentMethod === 'transfer'}
                  onSelect={() => patch({ paymentMethod: 'transfer' })}
                />
                )}
              </div>
              {show('paymentMethod') && <p className="text-[14px] text-red-deep">{errors.paymentMethod}</p>}
            </Group>
          </div>
        )}

        <aside className="md:col-span-5" aria-labelledby="summary-title">
          <div ref={summaryRef} className={`rounded-[20px] bg-paper p-6 ${summaryFits ? 'md:sticky md:top-[calc(var(--nav-h)+24px)]' : ''} max-sm:rounded-none max-sm:border-t max-sm:border-line max-sm:bg-transparent max-sm:px-0 max-sm:pt-7`}>
            <div className="flex items-baseline justify-between">
              <h2 id="summary-title" className="text-[20px] tracking-[-0.015em]">
                {t.yourOrder}
              </h2>
              <CarryLink href="/cart" className="-mr-2 flex min-h-11 items-center rounded px-2 text-[15px] text-muted underline underline-offset-4 hover:text-ink">
                {t.edit}
              </CarryLink>
            </div>

            <ul className="mt-2 divide-y divide-mist-2 border-y border-mist-2 max-md:hidden">
              {lines.map((l) => (
                <SummaryLine key={l.key} line={l} />
              ))}
            </ul>

            {anyMethod && <PromoField promo={promo} setPromo={setPromo} lines={lines} email={form.email} locale={locale} t={t} codeProblem={withCode?.code?.problem ? true : false} />}

            <div className="mt-4">
              <Totals pricing={pricing} shippingMinor={shipping} />
            </div>
            <p className="text-right text-[13px] text-muted">{ui[locale].vat}</p>
            {/* The only product suggestion in the checkout: light, before the payment decision. */}
            {anyMethod && <Suggestions placement="checkout" className="mt-4" />}

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
                      {t.accept}{' '}
                      <Link href="/terms-of-service" target="_blank" className="font-medium text-ink underline underline-offset-4">
                        {t.terms}
                      </Link>
                      .
                    </span>
                  </label>
                  {show('acceptedTerms') && (
                    <p id="e-acceptedTerms" className="text-[14px] text-red-deep">
                      {errors.acceptedTerms}
                    </p>
                  )}
                  <CommunicationsConsent checked={form.marketingConsent} onChange={(v) => patch({ marketingConsent: v })} locale={locale} emailOnly={intl} className="text-[15px]" />
                  <p className="text-[13.5px] leading-snug text-muted">
                    {t.dataUse}{' '}
                    <Link href="/privacy-policy" target="_blank" className="underline underline-offset-4 hover:text-ink">
                      {t.privacy}
                    </Link>
                    .
                  </p>
                </div>

                {submitted && Object.keys(errors).length > 0 && !serverError && (
                  <p role="alert" className="mt-4 text-[14.5px] text-red-deep">
                    {t.fixFields}
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
                      <span aria-hidden className="spinner" /> {form.paymentMethod === 'card' ? t.paying : t.sending}
                    </>
                  ) : form.paymentMethod === 'card' ? (
                    <>
                      <Lock /> {t.pay(money.fmt(total))}
                    </>
                  ) : (
                    <>{t.placeOrder}</>
                  )}
                </button>
                <p className="mt-3 text-center text-[14px] leading-snug text-text">
                  {form.paymentMethod === 'card'
                    ? t.cardAfter
                    : form.paymentMethod === 'cod'
                      ? t.codAfter(money.fmt(total))
                      : t.transferAfter}
                </p>
                <p className="mt-2 text-center text-[13.5px] leading-snug text-muted">
                  <Link href="/politica-retur" target="_blank" className="underline underline-offset-4 hover:text-ink">
                    {t.withdrawal}
                  </Link>{' '}
                  ·{' '}
                  <Link href="/garantie" target="_blank" className="underline underline-offset-4 hover:text-ink">
                    {t.warranty}
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
  t,
  country,
  locale,
}: {
  t: Copy
  prefix: '' | 'ship'
  bind: (f: keyof OrderFields) => Record<string, unknown>
  show: (f: FieldName) => string | undefined
  autoComplete: boolean
  country: string
  locale: Locale
}) {
  const k = (f: 'city' | 'county' | 'postalCode' | 'country') => (prefix ? (`ship${f[0].toUpperCase()}${f.slice(1)}` as keyof OrderFields) : f)
  const ac = (v: string) => (autoComplete ? `${prefix ? 'shipping' : 'billing'} ${v}` : 'off')
  const options = useMemo(() => countryOptions(locale), [locale])
  const ro = country === 'RO'
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.3fr_1fr_0.8fr] sm:gap-4">
        <Field name={k('city')} label={t.city} error={show(k('city'))} className="col-span-2 sm:col-span-1">
          <input autoComplete={ac('address-level2')} {...bind(k('city'))} />
        </Field>
        {ro ? (
          <Field name={k('county')} label={t.county} error={show(k('county'))}>
            <select autoComplete={ac('address-level1')} {...bind(k('county'))}>
              <option value="">{t.choose}</option>
              {COUNTIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field name={k('county')} label={t.region} optional error={show(k('county'))}>
            <input autoComplete={ac('address-level1')} maxLength={40} {...bind(k('county'))} />
          </Field>
        )}
        <Field name={k('postalCode')} label={t.postalCode} error={show(k('postalCode'))}>
          <input inputMode={ro ? 'numeric' : 'text'} autoComplete={ac('postal-code')} maxLength={ro ? 6 : 12} {...bind(k('postalCode'))} />
        </Field>
      </div>
      <Field name={k('country')} label={t.countryLabel} error={show(k('country'))}>
        <select autoComplete={ac('country')} {...bind(k('country'))}>
          {!isCountry(country) && <option value="">{t.choose}</option>}
          {options.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
    </>
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
  unavailableNote,
  children,
}: {
  id: PaymentMethod
  icon: ReactNode
  title: string
  text: string
  available: boolean
  /** Replaces the "În curând" mark of an unavailable method ('' = no mark, the text explains it). */
  unavailableNote?: string
  checked: boolean
  onSelect: () => void
  children?: ReactNode
}) {
  const on = checked && available
  const t = useCopy()
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
            {!available && unavailableNote !== '' && <span className="rounded-full bg-paper px-2 py-0.5 text-[12.5px] font-medium text-muted">{unavailableNote ?? t.soon}</span>}
          </span>
          <span className={`mt-0.5 block text-[14.5px] leading-snug ${available ? 'text-text' : 'text-muted'}`}>{text}</span>
        </span>
        <span className={available ? 'text-ink' : 'text-faint'}>{icon}</span>
      </label>
      {children}
    </div>
  )
}

/** A product in the order: quantity and removal right here (no detour through the cart), and its bundle offer. */
function SummaryLine({ line: l }: { line: ResolvedLine }) {
  const t = useCopy()
  const money = useMoney()
  const { setQuantity, remove } = useCart()
  return (
    <li className="grid grid-cols-[72px_1fr_auto] items-start gap-x-3.5 py-3.5">
      <span className="relative">
        <Thumb image={l.variant?.images[0] ?? l.product.cutout} sizes="72px" className="h-14 w-[72px] bg-mist" />
        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11.5px] font-semibold text-white tabular-nums">
          {l.quantity}
        </span>
      </span>
      <span className="min-w-0 text-[14.5px] leading-snug">
        <span className="block font-medium text-ink">{l.product.name}</span>
        <span className="block text-muted">{l.variantLabel ?? l.product.purpose}</span>
        {l.quantity > 1 && <span className="block text-[13px] text-muted">{money.fmt(l.unit)} / {t.perUnit}</span>}
        <span className="mt-2 flex items-center gap-2">
          <QuantityStepper size="sm" max={maxQtyFor(l.product.id)} value={l.quantity} onChange={(q) => setQuantity(l.key, q)} label={t.quantityOf(l.product.name)} />
          <button
            type="button"
            onClick={() => remove(l.key)}
            className="flex min-h-11 items-center rounded px-2 text-[14px] text-muted underline underline-offset-4 hover:text-ink"
            aria-label={t.removeOf(`${l.product.name}${l.variantLabel ? `, ${l.variantLabel}` : ''}`)}
          >
            {t.remove}
          </button>
        </span>
      </span>
      <span className="text-[15px] font-medium text-ink tabular-nums">{money.fmt(l.unit * l.quantity)}</span>
      <LineBundle line={l} placement="checkout" className="col-span-3 mt-3" />
    </li>
  )
}

/**
 * One numbered group of the form: a white panel from tablets up; on phones an open section separated by
 * a hairline, so the page is not a stack of boxes.
 */
function Group({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-[20px] bg-paper p-6 max-sm:rounded-none max-sm:border-t max-sm:border-line max-sm:bg-transparent max-sm:px-0 max-sm:pt-7 max-sm:pb-1">
      <legend className="float-left mb-5 flex w-full items-center gap-3 text-[19px] font-medium tracking-[-0.015em] text-ink">
        <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-mist text-[13.5px] font-semibold tabular-nums max-sm:bg-paper max-sm:shadow-[inset_0_0_0_1px_var(--color-line)]">
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
  className,
  children,
}: {
  name: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  className?: string
  children: ReactElement<Record<string, unknown>>
}) {
  const described = [hint && !error && `h-${name}`, error && `e-${name}`].filter(Boolean).join(' ') || undefined
  const t = useCopy()
  const control = cloneElement(children, {
    id: `f-${name}`,
    'aria-invalid': !!error,
    'aria-describedby': described,
    'aria-required': optional ? undefined : true,
    className: `field ${error ? 'field-error' : ''}`,
  })
  return (
    <div className={className}>
      <label htmlFor={`f-${name}`} className="mb-1.5 block text-[14.5px] font-medium text-ink">
        {label} {optional && <span className="font-normal text-muted">{t.optional}</span>}
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

type PromoState = { input: string; rule: PromoCodeRule | null; error: string | null; busy: boolean; open: boolean }

/** The promo code field: folded until asked for, checked by the server, removable. */
function PromoField({
  promo,
  setPromo,
  lines,
  email,
  locale,
  t,
  codeProblem,
}: {
  promo: PromoState
  setPromo: React.Dispatch<React.SetStateAction<PromoState>>
  lines: ResolvedLine[]
  email: string
  locale: Locale
  t: (typeof COPY)[Locale]
  codeProblem: boolean
}) {
  async function apply() {
    if (promo.busy) return
    const code = promo.input.trim()
    if (!code) return setPromo((p) => ({ ...p, error: locale === 'en' ? 'Enter the promo code.' : 'Scrie codul promoțional.' }))
    setPromo((p) => ({ ...p, busy: true, error: null }))
    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email, locale, lines: lines.map((l) => ({ productId: l.product.id, variantId: l.variant?.id, quantity: l.quantity })) }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.ok && data.rule) setPromo((p) => ({ ...p, rule: data.rule as PromoCodeRule, input: (data.rule as PromoCodeRule).code, busy: false, error: null }))
      else setPromo((p) => ({ ...p, rule: null, busy: false, error: data.message ?? t.failed }))
    } catch {
      setPromo((p) => ({ ...p, busy: false, error: t.offline }))
    }
  }

  if (promo.rule && !codeProblem)
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-[12px] bg-mist px-4 py-3 text-[14.5px]">
        <span className="text-ink">{t.promoApplied(promo.rule.code)}</span>
        <button type="button" onClick={() => setPromo({ input: '', rule: null, error: null, busy: false, open: false })} className="text-muted underline underline-offset-4 hover:text-ink">
          {t.promoRemove}
        </button>
      </div>
    )
  if (!promo.open && !promo.error && !codeProblem)
    return (
      <button type="button" onClick={() => setPromo((p) => ({ ...p, open: true }))} className="mt-4 text-[14.5px] text-ink underline underline-offset-4">
        {t.promoLabel}
      </button>
    )
  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <input
          id="f-promo"
          value={promo.input}
          onChange={(e) => setPromo((p) => ({ ...p, input: e.target.value.toUpperCase(), error: null }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void apply()
            }
          }}
          placeholder={t.promoPlaceholder}
          aria-label={t.promoPlaceholder}
          aria-invalid={!!promo.error}
          aria-describedby={promo.error ? 'e-promo' : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          className={`field flex-1 uppercase ${promo.error ? 'field-error' : ''}`}
        />
        <button type="button" onClick={() => void apply()} disabled={promo.busy} className="btn-secondary shrink-0">
          {promo.busy ? t.promoApplying : t.promoApply}
        </button>
      </div>
      {(promo.error || codeProblem) && (
        <p id="e-promo" className="mt-1.5 text-[14px] text-red-deep">
          {promo.error ?? (locale === 'en' ? 'The code no longer applies to this cart.' : 'Codul nu se mai aplică acestui coș.')}
        </p>
      )}
    </div>
  )
}

/** Whether the element (plus the header and a margin) fits the window's height; follows resizes of both. */
function useFitsWindow(ref: React.RefObject<HTMLElement | null>) {
  const [fits, setFits] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64
      setFits(el.offsetHeight + nav + 48 <= window.innerHeight)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    window.addEventListener('resize', check)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [ref])
  return fits
}
