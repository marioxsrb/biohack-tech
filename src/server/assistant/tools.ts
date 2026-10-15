/**
 * The website assistant's tools. Every input is validated (zod, strict ids, bounded strings); every answer comes
 * from the catalog, the server's own pricing or the database, never from the model. Nothing here places an order,
 * moves money or changes the cart: adding to the cart and cancelling are proposals the visitor confirms with a
 * button in the chat (the cart in the browser; the cancellation through /api/assistant/cancel with a signed token).
 *
 * Order tools work only for an order proved with the email code in this conversation (`ctx.verified`).
 */
import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { getProduct, productsIn, resolveLine, unitPrice, variantLabel, type ProductId } from '@/content/catalog'
import { promoText, PROMOTIONS } from '@/config/promotions'
import { formatLei } from '@/lib/money'
import { MAX_QTY } from '@/lib/purchase'
import { priceLines, promotionHints } from '@/lib/promotions'
import type { Config } from '@/server/config'
import type { Queryable } from '@/server/db'
import { orders } from '@/server/orders/repository'
import { CANCEL_TTL_MS, normalizeOrderNumber, orderView, REF_TTL_MS, requestOrderCode, selfCancellable, signToken, verifyOrderCode } from './orders'
import { isSupportCategory, SUPPORT_CATEGORIES, supportRequests } from './support'

export const PRODUCT_IDS = ['balance-wave', 'brainlink-pro', 'ochelari-biohack'] as const satisfies readonly ProductId[]

export type CartInput = { productId: string; variantId?: string; quantity: number }[]

export type ToolContext = {
  db: Queryable
  config: Config
  locked: boolean
  gated: boolean
  locale: 'ro' | 'en'
  /** The visitor's cart as the browser sent it (validated again here). */
  cart: CartInput
  /** Order ids proved with the email code in this conversation (signed references, checked by the route). */
  verified: Map<string, string>
  /** Called after a support request is created (the route schedules the outbox run). */
  onQueued: () => void
}

const productId = z.enum(PRODUCT_IDS)
const variantId = z.string().regex(/^[\w-]{1,60}$/).optional()
const orderNumber = z.string().min(5).max(40)

/** One product as the chat card shows it; the price only when prices may be shown. */
function card(id: ProductId, ctx: ToolContext) {
  const p = getProduct(id, ctx.locale)!
  const promo = PROMOTIONS.find((x) => (x.products as string[]).includes(p.id))
  return {
    id: p.id,
    name: p.name,
    purpose: p.purpose,
    tagline: p.tagline,
    href: `${ctx.locale === 'en' ? '/en' : ''}/products/${p.slug}`,
    soldOut: !!p.soldOut,
    ...(!ctx.locked && p.price !== null && { price: `${p.variablePrice ? (ctx.locale === 'en' ? 'from ' : 'de la ') : ''}${formatLei(p.price)}` }),
    ...(!ctx.locked && promo && { promotion: promoText(promo.badge, ctx.locale) }),
    ...(p.variants?.length && { variants: p.variants.map((v) => ({ id: v.id, label: variantLabel(p, v) })) }),
  }
}

export function assistantTools(ctx: ToolContext) {
  const verifiedOrder = async (n: string) => {
    const number = normalizeOrderNumber(n)
    const id = ctx.verified.get(number)
    return id ? orders.byId(ctx.db, id) : null
  }
  const notVerified = { verified: false as const, message: 'Comanda nu este verificată în această conversație. Cere numărul comenzii și emailul, apoi codul din email.' }

  return {
    show_products: tool({
      description: 'Arată cardurile produselor (imagine, scop, preț dacă e permis). Pentru recomandări și comparații.',
      inputSchema: z.object({ productIds: z.array(productId).min(1).max(3) }),
      execute: async ({ productIds }) => ({ locked: ctx.locked, products: [...new Set(productIds)].map((id) => card(id, ctx)) }),
    }),

    propose_add_to_cart: tool({
      description: 'Propune adăugarea unui produs în coș. Vizitatorul confirmă printr-un buton; nimic nu se adaugă fără clic. La NEUROS Amber fără variantă aleasă, cardul îl lasă să aleagă rama.',
      inputSchema: z.object({ productId, variantId, quantity: z.number().int().min(1).max(MAX_QTY).default(1) }),
      execute: async ({ productId, variantId, quantity }) => {
        const p = getProduct(productId, ctx.locale)!
        if (ctx.locked) return { status: 'locked' as const, productId, name: p.name, message: 'Pe această pagină coșul se deschide după formularul „Vezi prețul și oferta”. Vizitatorul vede acum butonul formularului (nu un buton de coș).' }
        if (p.soldOut) return { status: 'sold_out' as const, productId, name: p.name }
        // No frame chosen, or one that does not exist: the card lets the visitor pick.
        if (p.variants?.length && (!variantId || !p.variants.some((v) => v.id === variantId))) return { status: 'choose_variant' as const, productId, name: p.name, quantity, variants: p.variants.map((v) => ({ id: v.id, label: variantLabel(p, v), price: formatLei(unitPrice(p, v) ?? 0) })) }
        const r = resolveLine(productId, variantId, ctx.locale)
        if (!r || r.unit === null) return { status: 'unavailable' as const, productId, name: p.name }
        return {
          status: 'confirm' as const,
          productId,
          variantId: r.variant?.id,
          variant: r.variant ? variantLabel(p, r.variant) : undefined,
          name: p.name,
          quantity,
          unitPrice: formatLei(r.unit),
        }
      },
    }),

    cart_summary: tool({
      description: 'Citește coșul actual al vizitatorului: produse, promoții aplicate, total (calculat de server) și ce reducere mai poate obține.',
      inputSchema: z.object({}),
      execute: async () => {
        const lines = ctx.cart.flatMap((l, i) => {
          const r = resolveLine(l.productId, l.variantId, ctx.locale)
          return r ? [{ key: String(i), r, quantity: l.quantity }] : []
        })
        if (!lines.length) return { empty: true as const }
        const items = lines.map((l) => `${l.quantity} × ${l.r.product.name}${l.r.variant ? ` (${variantLabel(l.r.product, l.r.variant)})` : ''}${l.r.unit === null ? ' (indisponibil)' : ''}`)
        if (ctx.locked) return { empty: false as const, locked: true as const, items }
        const priced = lines.filter((l) => l.r.unit !== null).map((l) => ({ key: l.key, productId: l.r.product.id, quantity: l.quantity, unitAmount: l.r.unit! }))
        const p = priceLines(priced)
        return {
          empty: false as const,
          items,
          subtotal: formatLei(p.subtotalMinor),
          promotions: p.promotions.map((a) => `${promoText(a.label, ctx.locale)}: −${formatLei(a.amountMinor)}`),
          total: formatLei(p.totalMinor),
          shipping: ctx.locale === 'en' ? 'free' : 'gratuită',
          hints: promotionHints(priced).map((h) => h.text),
        }
      },
    }),

    open_page: tool({
      description: 'Afișează un buton spre coș, checkout sau pagina unui produs.',
      inputSchema: z.object({ page: z.enum(['cart', 'checkout', 'product']), productId: productId.optional() }),
      execute: async ({ page, productId }) => {
        const base = ctx.locale === 'en' ? '/en' : ''
        if (page === 'product' && productId) return { page, href: `${base}/products/${getProduct(productId)!.slug}`, label: getProduct(productId, ctx.locale)!.name }
        if (page === 'checkout') return { page, href: `${base}/checkout`, label: ctx.locale === 'en' ? 'Go to checkout' : 'Mergi la finalizarea comenzii' }
        return { page: 'cart' as const, href: `${base}/cart`, label: ctx.locale === 'en' ? 'Open cart' : 'Deschide coșul' }
      },
    }),

    ...(ctx.gated && {
      show_price_form: tool({
        description: 'Afișează butonul care deschide formularul „Vezi prețul și oferta” (doar pe pagina cu prețuri ascunse).',
        inputSchema: z.object({ productId: productId.optional() }),
        execute: async ({ productId }) => ({ locked: ctx.locked, productId, message: ctx.locked ? 'Butonul „Vezi prețul și oferta” este afișat vizitatorului în chat; formularul se deschide când apasă pe el.' : 'Prețurile sunt deja vizibile pe această pagină.' }),
      }),
    }),

    request_order_code: tool({
      description: 'Trimite un cod de 6 cifre pe emailul comenzii, dacă numărul și emailul aparțin aceleiași comenzi. Răspunsul nu spune dacă s-au potrivit.',
      inputSchema: z.object({ orderNumber, email: z.string().email().max(200) }),
      execute: async ({ orderNumber, email }) => {
        const r = await requestOrderCode(ctx.db, ctx.config, { orderNumber, email })
        if (r === 'off') return { sent: false as const, message: 'Verificarea comenzilor nu este disponibilă acum. Propune o cerere către echipă.' }
        if (r === 'failed') return { sent: false as const, message: 'Emailul cu codul nu a putut fi trimis acum. Propune o cerere către echipă sau o nouă încercare peste câteva minute.' }
        if (r === 'limited') return { sent: false as const, message: 'S-au cerut prea multe coduri pentru această comandă în ultima oră. Vizitatorul poate folosi ultimul cod primit sau poate reveni peste o oră.' }
        return { sent: 'maybe' as const, message: 'Dacă numărul și emailul aparțin aceleiași comenzi, codul a plecat pe acel email (valabil 10 minute; poate ajunge în Spam sau Promoții).' }
      },
    }),

    verify_order_code: tool({
      description: 'Verifică codul de 6 cifre primit pe email pentru o comandă. După succes, comanda poate fi consultată în această conversație.',
      inputSchema: z.object({ orderNumber, code: z.string().min(4).max(12) }),
      execute: async ({ orderNumber, code }) => {
        const r = await verifyOrderCode(ctx.db, { orderNumber, code })
        if (!r.ok) {
          const message = { invalid: 'Codul nu este corect.', expired: 'Codul a expirat; se poate cere unul nou.', too_many: 'Prea multe încercări greșite; se poate cere un cod nou.', off: 'Verificarea nu este disponibilă acum.' }[r.reason]
          return { verified: false as const, message }
        }
        ctx.verified.set(r.order.orderNumber, r.order.id)
        // `ref` proves the order on the next turns; the route removes it before the model sees the conversation.
        return { verified: true as const, ref: signToken('ref', r.order.id, REF_TTL_MS), order: orderView(r.order) }
      },
    }),

    get_order_status: tool({
      description: 'Starea unei comenzi verificate cu codul din email: produse, plată, livrare, AWB.',
      inputSchema: z.object({ orderNumber }),
      execute: async ({ orderNumber }) => {
        const o = await verifiedOrder(orderNumber)
        if (!o) return notVerified
        return { verified: true as const, order: orderView(o) }
      },
    }),

    propose_cancellation: tool({
      description: 'Verifică dacă o comandă verificată poate fi anulată din asistent. Dacă da, afișează butonul de confirmare (vizitatorul confirmă). Dacă nu, întoarce motivul.',
      inputSchema: z.object({ orderNumber }),
      execute: async ({ orderNumber }) => {
        const o = await verifiedOrder(orderNumber)
        if (!o) return notVerified
        const can = selfCancellable(o)
        if (!can.ok) return { eligible: false as const, orderNumber: o.orderNumber, why: can.why }
        return {
          eligible: true as const,
          orderNumber: o.orderNumber,
          items: o.items.map((i) => `${i.quantity} × ${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`),
          total: formatLei(o.totalMinor),
          cancelToken: signToken('cancel', o.id, CANCEL_TTL_MS),
        }
      },
    }),

    create_support_request: tool({
      description: `Trimite o cerere către echipă. Categorii: ${Object.entries(SUPPORT_CATEGORIES).map(([k, v]) => `${k} (${v})`).join(', ')}. Necesită comanda verificată sau un email ori telefon de contact.`,
      inputSchema: z.object({
        category: z.enum(Object.keys(SUPPORT_CATEGORIES) as [keyof typeof SUPPORT_CATEGORIES, ...(keyof typeof SUPPORT_CATEGORIES)[]]),
        summary: z.string().min(5).max(800),
        orderNumber: orderNumber.optional(),
        name: z.string().max(120).optional(),
        email: z.string().email().max(200).optional(),
        phone: z.string().regex(/^[+\d\s().-]{6,25}$/).optional(),
        urgent: z.boolean().default(false),
      }),
      execute: async (x) => {
        if (!isSupportCategory(x.category)) return { created: false as const, message: 'Categorie necunoscută.' }
        const o = x.orderNumber ? await verifiedOrder(x.orderNumber) : null
        const email = o?.email ?? x.email ?? null
        if (!o && !x.email && !x.phone) return { created: false as const, message: 'Lipsește un mod de contact: cere emailul sau telefonul (sau verifică întâi comanda).' }
        // An order number that was not verified is kept only as text in the summary, never linked.
        const summary = x.orderNumber && !o ? `${x.summary} (comanda menționată, neverificată: ${normalizeOrderNumber(x.orderNumber)})` : x.summary
        const r = await supportRequests.create(ctx.db, { category: x.category, summary, orderId: o?.id ?? null, email, name: x.name ?? null, phone: x.phone ?? null, urgent: x.urgent }, true)
        if (r.created) ctx.onQueued()
        return { created: true as const, alreadyOpen: !r.created, reference: r.request.ref }
      },
    }),
  }
}

/** The product list for the model's own reference (ids it may pass to tools). */
export const productIdGuide = () =>
  productsIn('ro')
    .map((p) => `${p.id} = ${p.name}${p.variants?.length ? ` (variantId: ${p.variants.map((v) => `${v.id} = ${variantLabel(p, v)}`).join('; ')})` : ''}`)
    .join('\n')
