/**
 * The purchase handoff (lib/purchase.ts, landing/checkout-link.ts, cart-store.ts).
 *
 * Regression for 29 Sep 2026: "Comandă" on a landing opened the checkout with ?item=… in the URL but
 * an empty cart ("Coșul tău este gol."). The checkout read window.location.search during render, which
 * on a client-side navigation still holds the landing's URL. Now the landing writes the selection into
 * the cart before navigating, and the checkout reads ?item from the router's search params.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attributionParams, attributionSummary, sanitizeAttribution } from '@/lib/attribution'
import { routeLanding } from '@/lib/landing-hosts'
import { encodeItem, parseItems, sourceForPath } from '@/lib/purchase'
import { priceLines } from '@/lib/promotions'
import { resolveOrderLines } from '@/lib/orders/resolve'

const KEY = 'biohack-cart-v1'
let storage: Map<string, string>

function fakeWindow(url: string) {
  storage = storage ?? new Map()
  const u = new URL(url)
  vi.stubGlobal('window', {
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) },
    location: { search: u.search, host: u.host, pathname: u.pathname, href: u.href },
    addEventListener() {},
    removeEventListener() {},
  })
}

/** A fresh page load: modules (and the in-memory cart) start again, only localStorage survives. */
async function page(url: string) {
  fakeWindow(url)
  vi.resetModules()
  const { cartStore } = await import('@/components/cart/cart-store')
  const { checkoutHref, startCheckout } = await import('@/components/landing/checkout-link')
  return { cartStore, checkoutHref, startCheckout }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  storage = new Map()
})

const LANDINGS = [
  { slug: 'calm', pick: { productId: 'balance-wave' as const }, name: 'NEUROS Calm', unit: 638000 },
  { slug: 'focus', pick: { productId: 'brainlink-pro' as const }, name: 'NEUROS Focus', unit: 322500 },
  { slug: 'amber', pick: { productId: 'ochelari-biohack' as const, variantId: 'patrat-maro', quantity: 3 }, name: 'NEUROS Amber', unit: 31500 },
] as const

describe('landing → checkout: the selection survives', () => {
  for (const l of LANDINGS) {
    it(`${l.slug}: an empty cart ends up with exactly the landing's product, variant and quantity`, async () => {
      const { cartStore, startCheckout } = await page(`https://${l.slug}.biohack-tech.ro/?utm_source=meta&utm_campaign=toamna&fbclid=x`)
      expect(cartStore.getSnapshot()).toEqual([])
      const push = vi.fn()
      startCheckout(push, l.slug, l.pick)

      // Written to the canonical cart before the navigation: the checkout's first render has it.
      const want = { productId: l.pick.productId, variantId: 'variantId' in l.pick ? l.pick.variantId : undefined, quantity: 'quantity' in l.pick ? l.pick.quantity : 1, source: 'landing' }
      expect(cartStore.getSnapshot()).toEqual([want])
      expect(JSON.parse(storage.get(KEY)!)).toEqual([JSON.parse(JSON.stringify(want))])

      // The URL carries the same selection and the campaign, nothing else.
      const url = new URL(push.mock.calls[0][0], 'https://x')
      expect(url.pathname).toBe('/checkout')
      expect(parseItems(url.searchParams, 'landing')).toEqual([want])
      expect(Object.fromEntries(attributionParams(url.searchParams))).toEqual({ lp: l.slug, lp_host: `${l.slug}.biohack-tech.ro`, utm_source: 'meta', utm_campaign: 'toamna' })

      // The server prices the same lines from the catalog; the public name is the catalog's.
      const order = resolveOrderLines(cartStore.getSnapshot())
      expect(order.ok && order.lines.map((x) => [x.productId, x.variantId, x.quantity, x.unitAmount, x.name])).toEqual([[want.productId, want.variantId, want.quantity, l.unit, l.name]])
    })
  }

  it('the link alone (new tab, shared link, full reload) gives the same cart as the click', async () => {
    for (const l of LANDINGS) {
      storage = new Map()
      const { cartStore, checkoutHref } = await page(`https://biohack-tech.ro/lp/${l.slug}`)
      const href = checkoutHref(l.slug, l.pick)
      cartStore.restore(parseItems(new URL(href, 'https://x').searchParams, 'landing'))
      expect(cartStore.getSnapshot().map((x) => [x.productId, x.variantId, x.quantity])).toEqual([
        [l.pick.productId, 'variantId' in l.pick ? l.pick.variantId : undefined, 'quantity' in l.pick ? l.pick.quantity : 1],
      ])
    }
  })

  it('refresh and repeated clicks never double the product; an existing cart is kept', async () => {
    let p = await page('https://biohack-tech.ro/lp/calm')
    p.cartStore.add('ochelari-biohack', 'cat-eye-bej', 1, 'product')
    p.startCheckout(vi.fn(), 'calm', { productId: 'balance-wave' })
    p.startCheckout(vi.fn(), 'calm', { productId: 'balance-wave' })
    // Reload of the checkout: new page, only storage survives; the ?item link is applied again.
    p = await page('https://biohack-tech.ro/checkout?item=balance-wave&lp=calm')
    p.cartStore.restore(parseItems('?item=balance-wave', 'landing'))
    expect(p.cartStore.getSnapshot()).toEqual([
      { productId: 'ochelari-biohack', variantId: 'cat-eye-bej', quantity: 1, source: 'product' },
      { productId: 'balance-wave', variantId: undefined, quantity: 1, source: 'landing' },
    ])
  })

  it('the checkout reads ?item from the router, not from window.location during render', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/[lang]/(checkout)/checkout/CheckoutView.tsx'), 'utf8')
    expect(src).toContain('useSearchParams()')
    expect(src).not.toMatch(/useState\(\s*\(\)\s*=>[^)]*window\.location\.search/)
  })
})

describe('NEUROS Flow (discontinued) in old carts and old links', () => {
  it('a saved cart with NEUROS Flow loads without it and keeps the other products; checkout gets only sellable lines', async () => {
    storage = new Map([[KEY, JSON.stringify([{ productId: 'brain-flow', variantId: '13-zone', quantity: 1 }, { productId: 'balance-wave', quantity: 2 }])]])
    const p = await page('https://biohack-tech.ro/cart')
    expect(p.cartStore.getSnapshot().map((l) => [l.productId, l.quantity])).toEqual([['balance-wave', 2]])
    expect(resolveOrderLines(p.cartStore.getSnapshot())).toMatchObject({ ok: true, total: 2 * 638000 - 127600 })
  })

  it('an old checkout or landing link for NEUROS Flow adds nothing', async () => {
    storage = new Map()
    expect(parseItems('?item=brain-flow:13-zone&lp=brain-flow')).toEqual([])
    const p = await page('https://biohack-tech.ro/checkout?item=brain-flow:4-zone')
    p.startCheckout(vi.fn(), 'brain-flow' as never, { productId: 'brain-flow' as never, variantId: '4-zone' })
    expect(p.cartStore.getSnapshot()).toEqual([])
  })
})

describe('the item parameter', () => {
  it('round-trips product, variant and quantity; drops what the catalog does not sell', () => {
    expect(encodeItem({ productId: 'ochelari-biohack', variantId: 'patrat-negru' })).toBe('ochelari-biohack:patrat-negru')
    expect(encodeItem({ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 3 })).toBe('ochelari-biohack:cat-eye-negru*3')
    expect(parseItems('?item=ochelari-biohack:cat-eye-negru*3&item=balance-wave')).toEqual([
      { productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 3, source: 'link' },
      { productId: 'balance-wave', variantId: undefined, quantity: 1, source: 'link' },
    ])
    // A product with variants needs one; a product without variants takes none; quantities are clamped.
    expect(parseItems('?item=brain-flow&item=brain-flow:4-zone&item=ochelari-biohack:nope&item=balance-wave:x&item=nu-exista&item=<script>')).toEqual([])
    expect(parseItems('?item=brainlink-pro*99')).toEqual([{ productId: 'brainlink-pro', variantId: undefined, quantity: 10, source: 'link' }])
    expect(parseItems('?item=brainlink-pro&item=brainlink-pro')[0].quantity).toBe(2)
  })

  it('names the surface a line was added from', () => {
    expect(['/', '/products', '/products/amber', '/lp/calm', '/cart', '/checkout', '/about-us'].map(sourceForPath)).toEqual([
      'home', 'catalog', 'product', 'landing', 'cart_offer', 'cart_offer', 'link',
    ])
  })
})

describe('landing hostnames keep the whole purchase path on one origin', () => {
  it('cart, checkout and product pages are served on the landing host (its storage holds the cart)', () => {
    for (const p of ['/cart', '/checkout', '/products', '/products/amber']) expect(routeLanding('amber', p)).toEqual({ action: 'next' })
  })
})

describe('attribution and promotions survive the handoff', () => {
  it('landing, campaign and entry reach the order; entry alone is kept for site orders', () => {
    const a = sanitizeAttribution({ lp: 'amber', lp_host: 'amber.biohack-tech.ro', utm_source: 'meta', entry: 'landing' }, 'biohack-tech.ro', 'biohack-tech.ro')
    expect(a).toEqual({ landing: 'amber', landingHost: 'amber.biohack-tech.ro', landingPath: '/', utm: { utm_source: 'meta' }, entry: 'landing' })
    expect(sanitizeAttribution({ entry: 'product' }, 'biohack-tech.ro')).toEqual({ entry: 'product' })
    expect(sanitizeAttribution({ entry: 'evil' }, 'biohack-tech.ro')).toBeNull()
    expect(attributionSummary({ entry: 'home' })).toBe('site, pagina principală')
  })

  it('Amber 2+1 from the landing and 20% on 3 Calm next to other products: cart = server', async () => {
    const p = await page('https://biohack-tech.ro/lp/amber')
    p.startCheckout(vi.fn(), 'amber', { productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 3 })
    p.cartStore.add('balance-wave', undefined, 3, 'home')
    p.cartStore.add('brainlink-pro', undefined, 1, 'product')
    p.cartStore.add('brain-flow' as never, '1-zona', 1, 'product') // discontinued: ignored
    const lines = p.cartStore.getSnapshot()
    expect(lines.map((l) => l.productId)).not.toContain('brain-flow')
    const shown = priceLines(
      lines.map((l) => ({ key: `${l.productId}:${l.variantId ?? ''}`, productId: l.productId, quantity: l.quantity, unitAmount: ({ 'balance-wave': 638000, 'brainlink-pro': 322500, 'ochelari-biohack': 31500 } as Record<string, number>)[l.productId]! })),
    )
    const server = resolveOrderLines(lines)
    expect(server.ok).toBe(true)
    if (!server.ok) return
    expect(server.promotions.map((x) => x.id).sort()).toEqual(['amber-2-plus-1', 'trei-produse-20:balance-wave'])
    expect(server.lines.filter((l) => l.productId !== 'balance-wave' && l.productId !== 'ochelari-biohack').every((l) => l.discountMinor === 0)).toBe(true)
    expect([server.subtotal, server.discount, server.total]).toEqual([shown.subtotalMinor, shown.discountMinor, shown.totalMinor])
    expect(server.promotions.find((x) => x.id === 'amber-2-plus-1')?.amountMinor).toBe(31500)
  })
})

describe('NEUROS Amber selection: several frames in one handoff', () => {
  const pick = (variantId: string, quantity: number) => ({ productId: 'ochelari-biohack' as const, variantId, quantity })
  const set = [pick('cat-eye-negru', 1), pick('cat-eye-bej', 1), pick('patrat-maro', 2)]

  it('each frame stays its own line with its quantity (not flattened into one frame × 4)', async () => {
    const p = await page('https://amber.biohack-tech.ro/?utm_source=meta&utm_campaign=mix')
    const push = vi.fn()
    p.startCheckout(push, 'amber', set, { exact: true })
    expect(p.cartStore.getSnapshot().map((l) => [l.variantId, l.quantity])).toEqual([
      ['cat-eye-negru', 1],
      ['cat-eye-bej', 1],
      ['patrat-maro', 2],
    ])
    const url = new URL(push.mock.calls[0][0], 'https://x')
    expect(url.searchParams.getAll('item')).toEqual(['ochelari-biohack:cat-eye-negru', 'ochelari-biohack:cat-eye-bej', 'ochelari-biohack:patrat-maro*2'])
    expect(parseItems(url.searchParams, 'landing').map((l) => [l.variantId, l.quantity])).toEqual([
      ['cat-eye-negru', 1],
      ['cat-eye-bej', 1],
      ['patrat-maro', 2],
    ])
    expect(Object.fromEntries(attributionParams(url.searchParams))).toMatchObject({ lp: 'amber', utm_source: 'meta', utm_campaign: 'mix' })

    // The server keeps every frame as its own order line and applies 2+1 across them.
    const order = resolveOrderLines(p.cartStore.getSnapshot())
    expect(order.ok && [order.lines.map((l) => [l.variantId, l.quantity, l.description]), order.subtotal, order.discount, order.total]).toEqual([
      [
        ['cat-eye-negru', 1, 'Cat eye · Negru'],
        ['cat-eye-bej', 1, 'Cat eye · Bej'],
        ['patrat-maro', 2, 'Unisex pătrat · Maro'],
      ],
      4 * 31500,
      31500,
      3 * 31500,
    ])
  })

  it('the chosen quantities are applied exactly; repeating the click, a reload or the link alone never doubles them', async () => {
    let p = await page('https://biohack-tech.ro/lp/amber')
    p.cartStore.add('ochelari-biohack', 'cat-eye-negru', 3, 'product') // an older cart line for a chosen frame
    p.cartStore.add('balance-wave', undefined, 1, 'home') // another product: kept
    p.startCheckout(vi.fn(), 'amber', set, { exact: true })
    p.startCheckout(vi.fn(), 'amber', set, { exact: true })
    const want = [
      ['ochelari-biohack', 'cat-eye-negru', 1],
      ['balance-wave', undefined, 1],
      ['ochelari-biohack', 'cat-eye-bej', 1],
      ['ochelari-biohack', 'patrat-maro', 2],
    ]
    expect(p.cartStore.getSnapshot().map((l) => [l.productId, l.variantId, l.quantity])).toEqual(want)
    // Reload of the checkout: only storage survives, and the ?item link is applied again.
    p = await page('https://biohack-tech.ro/checkout')
    p.cartStore.restore(parseItems(new URL(p.checkoutHref('amber', set), 'https://x').searchParams, 'landing'))
    expect(p.cartStore.getSnapshot().map((l) => [l.productId, l.variantId, l.quantity])).toEqual(want)
  })
})

describe('a changed selection on a landing replaces the previous one (not added to it)', () => {
  const pick = (variantId: string, quantity: number) => ({ productId: 'ochelari-biohack' as const, variantId, quantity })

  it('Amber: a frame taken out on the landing leaves the cart; other products stay', async () => {
    const p = await page('https://amber.biohack-tech.ro/')
    p.cartStore.add('balance-wave', undefined, 1, 'home')
    p.startCheckout(vi.fn(), 'amber', [pick('cat-eye-negru', 2), pick('cat-eye-bej', 1)], { exact: true })
    // Back on the landing: Bej swapped for Maro.
    p.startCheckout(vi.fn(), 'amber', [pick('cat-eye-negru', 2), pick('patrat-maro', 1)], { exact: true })
    expect(p.cartStore.getSnapshot().map((l) => [l.productId, l.variantId ?? null, l.quantity])).toEqual([
      ['balance-wave', null, 1],
      ['ochelari-biohack', 'cat-eye-negru', 2],
      ['ochelari-biohack', 'patrat-maro', 1],
    ])
  })

  it('Calm with a quantity picker: a lower quantity chosen later is respected', async () => {
    const p = await page('https://calm.biohack-tech.ro/')
    p.startCheckout(vi.fn(), 'calm', { productId: 'balance-wave', quantity: 3 }, { exact: true })
    p.startCheckout(vi.fn(), 'calm', { productId: 'balance-wave', quantity: 1 }, { exact: true })
    expect(p.cartStore.getSnapshot().map((l) => [l.productId, l.quantity])).toEqual([['balance-wave', 1]])
  })
})

describe('the checkout is focused', () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

  it('has its own layout: no site header, footer, product lists or catalog links', () => {
    const layout = read('src/app/[lang]/(checkout)/layout.tsx')
    expect(layout).not.toMatch(/components\/site\/(Header|Footer)/)
    for (const f of ['src/components/checkout/CheckoutHeader.tsx', 'src/components/checkout/CheckoutFooter.tsx']) {
      const src = read(f)
      expect(src).not.toMatch(/products|productHref|\/products|Vezi produsele|NEUROS (Calm|Focus|Amber|Flow)/)
    }
  })

  it('keeps every legal and help link a buyer needs', () => {
    const footer = readFileSync(join(process.cwd(), 'src/components/checkout/CheckoutFooter.tsx'), 'utf8')
    for (const href of ['/terms-of-service', '/privacy-policy', '/politica-cookies', '/politica-livrare', '/plati', '/politica-retur', '/garantie', '/retragere', 'reclamatiisal.anpc.ro', 'CookieSettingsButton', 'companyLine', 'site.email', 'site.phone'])
      expect(footer).toContain(href)
  })

  it('from a landing, the brand leads back to that landing', () => {
    expect(read('src/components/checkout/CheckoutHeader.tsx')).toMatch(/isLandingSlug\(lp\) \? `\/lp\/\$\{lp\}` : '\/'/)
  })
})
