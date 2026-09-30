/**
 * Commerce catalog: everything the cart, checkout and API need about a product.
 * Storytelling (benefits, steps, specs, FAQ) lives in product-content.ts so the
 * cart's client bundle stays small. Prices live in config/prices.ts.
 *
 * Naming: NEUROS is the maker (the neck device already carries the NEUROS logo; the
 * headset's app is Neuros Game). Each product is NEUROS + one short word for what it's for:
 * Calm, Focus, Amber, Flow. Biohack Tech is the store. The photobiomodulation helmet was sold as
 * "Brain Flow" on the previous site; since 29.09.2026 it is NEUROS Flow for customers, while its
 * technical id stays `brain-flow` (orders, URLs, CRM tags, landing host). Internal ids stay unchanged so carts
 * saved before the rename still resolve.
 */
import type { StaticImageData } from 'next/image'
import { PRICES_RON, type PriceEntry } from '@/config/prices'

import glCatNegru1 from '@/assets/img/glasses/cat-eye-negru-1.webp'
import glCatNegru2 from '@/assets/img/glasses/cat-eye-negru-2.webp'
import glCatNegru3 from '@/assets/img/glasses/cat-eye-negru-3.webp'
import glCatNegru4 from '@/assets/img/glasses/cat-eye-negru-4.webp'
import glCatNegru5 from '@/assets/img/glasses/cat-eye-negru-5.webp'
import glCatBej1 from '@/assets/img/glasses/cat-eye-bej-1.webp'
import glCatBej2 from '@/assets/img/glasses/cat-eye-bej-2.webp'
import glCatBej3 from '@/assets/img/glasses/cat-eye-bej-3.webp'
import glCatBej4 from '@/assets/img/glasses/cat-eye-bej-4.webp'
import glSqNegru1 from '@/assets/img/glasses/patrat-negru-1.webp'
import glSqNegru2 from '@/assets/img/glasses/patrat-negru-2.webp'
import glSqNegru3 from '@/assets/img/glasses/patrat-negru-3.webp'
import glSqNegru4 from '@/assets/img/glasses/patrat-negru-4.webp'
import glSqMaro1 from '@/assets/img/glasses/patrat-maro-1.webp'
import glSqMaro2 from '@/assets/img/glasses/patrat-maro-2.webp'
import glSqMaro3 from '@/assets/img/glasses/patrat-maro-3.webp'
import glSqMaro4 from '@/assets/img/glasses/patrat-maro-4.webp'
import glTerasa from '@/assets/img/glasses/lifestyle-terasa.webp'
import glPortret from '@/assets/img/glasses/result-stil.webp'
import glSeara from '@/assets/img/glasses/result-seara.webp'
import glNoptiera from '@/assets/img/glasses/audience-seara.webp'
import glBirou from '@/assets/img/glasses/audience-birou.webp'
import glToate from '@/assets/img/glasses/audience-stil.webp'

import bwActiv from '@/assets/img/balance-wave/dispozitiv-activ.webp'
import bwDispozitiv from '@/assets/img/balance-wave/dispozitiv.webp'
import bwCutie from '@/assets/img/balance-wave/cutie.webp'
import bwPurtat from '@/assets/img/balance-wave/result-echilibru.webp'
import bwCanapea from '@/assets/img/balance-wave/lifestyle-canapea.webp'

import blCasca from '@/assets/img/brainlink/casca.webp'
import blLateral from '@/assets/img/brainlink/casca-lateral.webp'
import blGeanta from '@/assets/img/brainlink/casca-geanta.webp'
import blTableta from '@/assets/img/brainlink/pillar-games.webp'
import blRelaxare from '@/assets/img/brainlink/lifestyle-relaxare.webp'

import bfCasca from '@/assets/img/brain-flow/casca.webp'
import bfTelecomanda from '@/assets/img/brain-flow/casca-telecomanda.webp'
import bfInterior from '@/assets/img/brain-flow/casca-interior.webp'
import bfFemeie from '@/assets/img/brain-flow/lifestyle-femeie.webp'
import bfFotoliu from '@/assets/img/brain-flow/fotoliu.webp'

/**
 * `cutout`: transparent product shot, shown whole on a neutral stage.
 * `photo`: photography, fills its frame.
 */
export type ImageKind = 'cutout' | 'photo'
export type ProductImage = {
  src: StaticImageData
  alt: string
  kind: ImageKind
  /** The product is cropped at this edge in the source photo; frames anchor it there. */
  bleed?: 'bottom'
}

export type Variant = {
  /** Stable id: stored in carts, orders, invoices and the CRM. Never rename one that has been sold. */
  id: string
  /** Option values, keyed by option id (e.g. { model: 'cat-eye', culoare: 'negru' }). */
  options: Record<string, string>
  images: ProductImage[]
  /** NEUROS Flow: how many zones the configuration can activate. */
  zones?: number
  /** Price in bani for this configuration, when it differs per variant (config/prices.ts). */
  price?: number | null
}

export type ProductOption = {
  id: string
  label: string
  values: { id: string; label: string; swatch?: string }[]
}

export type ProductId = 'ochelari-biohack' | 'balance-wave' | 'brainlink-pro' | 'brain-flow'

export type Product = {
  id: ProductId
  /** URL segment. */
  slug: string
  /** Maker shown above the model name. */
  brand?: 'NEUROS'
  /** The short name: Calm, Focus, Amber, Flow. */
  model: string
  /** Full customer-facing name: "NEUROS Calm". */
  name: string
  /** What kind of object it is, in plain words. */
  kind: string
  /** What it's for: "Pentru relaxare". */
  purpose: string
  /** One plain sentence. */
  tagline: string
  /**
   * Price in bani, VAT included. null = no approved price in lei yet (not purchasable).
   * With per-variant prices this is the lowest one ("de la"); the line price is `unitPrice()`.
   */
  price: number | null
  /** True when variants have different prices. */
  variablePrice?: boolean
  /** The product on its own: listings, cart, popup, menu. */
  cutout: ProductImage
  /** The product in use: sharing image and editorial sections. */
  lifestyle: ProductImage
  /** Gallery when the product has no variants. Order is deliberate: product, in use, angles, details. */
  images: ProductImage[]
  options?: ProductOption[]
  variants?: Variant[]
  /** Button that sends the closing section back to the variant picker: "Alege rama". */
  chooseLabel?: string
  /** Includes an onboarding consultation with a specialist (stated on the source site). */
  guidance: boolean
}

const cut = (src: StaticImageData, alt: string, bleed?: 'bottom'): ProductImage => ({ src, alt, kind: 'cutout', bleed })
const photo = (src: StaticImageData, alt: string): ProductImage => ({ src, alt, kind: 'photo' })

/** Applies config/prices.ts to a product: one price, or one per variant plus the lowest as "de la". */
function priced(p: Omit<Product, 'price'>): Product {
  const entry: PriceEntry | undefined = PRICES_RON[p.id]
  if (entry === null || entry === undefined || typeof entry === 'number') return { ...p, price: entry ?? null }
  const variants = p.variants?.map((v) => ({ ...v, price: entry[v.id] ?? null }))
  const known = (variants ?? []).map((v) => v.price).filter((x): x is number => typeof x === 'number')
  return { ...p, variants, price: known.length ? Math.min(...known) : null, variablePrice: new Set(known).size > 1 }
}

const brainFlowGallery = [
  cut(bfCasca, 'NEUROS Flow, casca albă cu LED-urile aprinse'),
  photo(bfFemeie, 'Femeie relaxată pe canapea, purtând casca NEUROS Flow'),
  cut(bfTelecomanda, 'NEUROS Flow lângă telecomanda inclusă'),
  cut(bfInterior, 'Interiorul căștii NEUROS Flow, cu LED-urile, lângă telecomandă și ochelari'),
  photo(bfFotoliu, 'Femeie într-un fotoliu, cu o cană în mână, lângă casca NEUROS Flow'),
]

/** Display order. Calm is the lead product on the source site. */
const catalog: Omit<Product, 'price'>[] = [
  {
    id: 'balance-wave',
    slug: 'calm',
    brand: 'NEUROS',
    model: 'Calm',
    name: 'NEUROS Calm',
    kind: 'Dispozitiv purtat la gât',
    purpose: 'Pentru relaxare',
    tagline: 'Se poartă la gât. Câteva minute de lumină roșie, apoi se oprește singur.',
    cutout: cut(bwActiv, 'NEUROS Calm, dispozitivul cu luminile roșii aprinse', 'bottom'),
    lifestyle: photo(bwCanapea, 'Femeie relaxată pe canapea, purtând NEUROS Calm la gât'),
    images: [
      cut(bwActiv, 'NEUROS Calm, dispozitivul cu luminile roșii aprinse', 'bottom'),
      photo(bwPurtat, 'Femeie cu ochii închiși, purtând NEUROS Calm la gât'),
      cut(bwDispozitiv, 'NEUROS Calm văzut din spate, cu butonul de pornire'),
      cut(bwCutie, 'NEUROS Calm lângă cutia produsului'),
      photo(bwCanapea, 'Femeie relaxată pe canapea, purtând NEUROS Calm'),
    ],
    guidance: true,
  },
  {
    id: 'brainlink-pro',
    slug: 'focus',
    brand: 'NEUROS',
    model: 'Focus',
    name: 'NEUROS Focus',
    kind: 'Cască pentru antrenamentul atenției',
    purpose: 'Pentru concentrare',
    tagline: 'O cască ușoară și jocuri pe tabletă, pe care le controlezi prin atenție.',
    cutout: cut(blCasca, 'NEUROS Focus, casca văzută din unghi'),
    lifestyle: photo(blTableta, 'Tânăr pe canapea, purtând NEUROS Focus și jucând pe tabletă'),
    images: [
      cut(blCasca, 'NEUROS Focus, casca văzută din unghi'),
      photo(blTableta, 'Tânăr pe canapea, purtând NEUROS Focus și jucând pe tabletă'),
      cut(blLateral, 'NEUROS Focus văzută din lateral, cu senzorul de ureche'),
      cut(blGeanta, 'NEUROS Focus lângă geanta de transport'),
      photo(blRelaxare, 'Femeie relaxată, cu ochii închiși, purtând NEUROS Focus'),
    ],
    guidance: true,
  },
  {
    id: 'ochelari-biohack',
    slug: 'amber',
    brand: 'NEUROS',
    model: 'Amber',
    name: 'NEUROS Amber',
    kind: 'Ochelari cu filtru pentru lumina albastră',
    purpose: 'Pentru ecrane',
    tagline: 'Ochelari care filtrează lumina albastră a ecranelor. Patru rame, același filtru.',
    cutout: cut(glCatNegru1, 'NEUROS Amber cat eye, ramă neagră, lentile chihlimbar'),
    lifestyle: photo(glTerasa, 'Femeie pe o terasă, purtând NEUROS Amber cat eye bej'),
    images: [photo(glToate, 'Cele patru rame NEUROS Amber, așezate pe o masă')],
    options: [
      {
        id: 'model',
        label: 'Model',
        values: [
          { id: 'cat-eye', label: 'Cat eye' },
          { id: 'patrat', label: 'Unisex pătrat' },
        ],
      },
      {
        id: 'culoare',
        label: 'Culoare',
        values: [
          { id: 'negru', label: 'Negru', swatch: '#15181A' },
          { id: 'bej', label: 'Bej', swatch: '#C9A193' },
          { id: 'maro', label: 'Maro', swatch: '#6B4A36' },
        ],
      },
    ],
    variants: [
      {
        id: 'cat-eye-negru',
        options: { model: 'cat-eye', culoare: 'negru' },
        images: [
          cut(glCatNegru1, 'NEUROS Amber cat eye negru, din față'),
          cut(glCatNegru2, 'NEUROS Amber cat eye negru, din unghi'),
          cut(glCatNegru5, 'NEUROS Amber cat eye negru, din lateral'),
          cut(glCatNegru3, 'NEUROS Amber cat eye negru, de sus'),
          cut(glCatNegru4, 'NEUROS Amber cat eye negru, din spate'),
          photo(glToate, 'Cele patru rame NEUROS Amber, printre ele cat eye negru'),
        ],
      },
      {
        id: 'cat-eye-bej',
        options: { model: 'cat-eye', culoare: 'bej' },
        images: [
          cut(glCatBej1, 'NEUROS Amber cat eye bej, din față'),
          photo(glPortret, 'Femeie purtând NEUROS Amber cat eye bej'),
          cut(glCatBej2, 'NEUROS Amber cat eye bej, din unghi'),
          cut(glCatBej3, 'NEUROS Amber cat eye bej, din lateral'),
          cut(glCatBej4, 'NEUROS Amber cat eye bej, din spate'),
          photo(glTerasa, 'Femeie pe o terasă, purtând NEUROS Amber cat eye bej'),
        ],
      },
      {
        id: 'patrat-negru',
        options: { model: 'patrat', culoare: 'negru' },
        images: [
          cut(glSqNegru1, 'NEUROS Amber unisex pătrat negru, din față'),
          photo(glSeara, 'Femeie în pat, seara, purtând NEUROS Amber pătrat negru'),
          cut(glSqNegru3, 'NEUROS Amber unisex pătrat negru, din unghi'),
          cut(glSqNegru2, 'NEUROS Amber unisex pătrat negru, din lateral'),
          cut(glSqNegru4, 'NEUROS Amber unisex pătrat negru, din spate'),
          photo(glNoptiera, 'NEUROS Amber pătrat negru pe noptieră, lângă laptop'),
        ],
      },
      {
        id: 'patrat-maro',
        options: { model: 'patrat', culoare: 'maro' },
        images: [
          cut(glSqMaro1, 'NEUROS Amber unisex pătrat maro, din față'),
          photo(glBirou, 'NEUROS Amber pătrat maro pe un birou, lângă tastatură'),
          cut(glSqMaro2, 'NEUROS Amber unisex pătrat maro, din unghi'),
          cut(glSqMaro3, 'NEUROS Amber unisex pătrat maro, din lateral'),
          cut(glSqMaro4, 'NEUROS Amber unisex pătrat maro, din spate'),
        ],
      },
    ],
    chooseLabel: 'Alege rama',
    guidance: false,
  },
  {
    id: 'brain-flow',
    slug: 'brain-flow',
    brand: 'NEUROS',
    model: 'Flow',
    name: 'NEUROS Flow',
    kind: 'Cască de fotobiomodulare, infraroșu 810 nm',
    purpose: 'Pentru rutina de acasă',
    tagline: 'O cască cu lumină infraroșie, folosită acasă, după un protocol stabilit cu un specialist.',
    cutout: cut(bfCasca, 'NEUROS Flow, casca albă cu LED-urile aprinse'),
    lifestyle: photo(bfFemeie, 'Femeie relaxată pe canapea, purtând casca NEUROS Flow'),
    images: brainFlowGallery,
    options: [
      {
        id: 'zone',
        label: 'Configurație',
        values: [
          { id: '1-zona', label: '1 zonă' },
          { id: '4-zone', label: '4 zone' },
          { id: '13-zone', label: '13 zone' },
        ],
      },
    ],
    // Same helmet and the same photographs for every configuration: the source shows no per-configuration images.
    variants: [
      { id: '1-zona', options: { zone: '1-zona' }, zones: 1, images: brainFlowGallery },
      { id: '4-zone', options: { zone: '4-zone' }, zones: 4, images: brainFlowGallery },
      { id: '13-zone', options: { zone: '13-zone' }, zones: 13, images: brainFlowGallery },
    ],
    chooseLabel: 'Alege configurația',
    guidance: true,
  },
]

export const products: Product[] = catalog.map(priced)

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id)
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug)
}

export function productHref(p: Product): string {
  return `/products/${p.slug}`
}

/** Has at least one approved price. A single line is priced with `unitPrice()`. */
export function isPurchasable(p: Product): p is Product & { price: number } {
  return p.price !== null
}

/** What one unit of this product (and variant) costs, in bani. null = not for sale. */
export function unitPrice(p: Product, v?: Variant): number | null {
  if (p.variablePrice) return v?.price ?? null
  return p.price
}

export function getVariant(p: Product, variantId?: string): Variant | undefined {
  return variantId ? p.variants?.find((v) => v.id === variantId) : undefined
}

/** "Cat eye · Negru" */
export function variantLabel(p: Product, v: Variant): string {
  return (p.options ?? [])
    .map((o) => o.values.find((val) => val.id === v.options[o.id])?.label)
    .filter(Boolean)
    .join(' · ')
}

/**
 * Validates a cart line against the catalog and prices it. Returns null for unknown products or
 * variants; `unit` is null when that line has no approved price.
 */
export function resolveLine(productId: string, variantId?: string): { product: Product; variant?: Variant; unit: number | null } | null {
  const product = getProduct(productId)
  if (!product) return null
  if (product.variants?.length) {
    const variant = getVariant(product, variantId)
    return variant ? { product, variant, unit: unitPrice(product, variant) } : null
  }
  return variantId ? null : { product, variant: undefined, unit: unitPrice(product) }
}

/** Internal reference for a line: product id, plus the variant id when there is one. No supplier SKU is known. */
export function lineRef(productId: string, variantId?: string | null): string {
  return variantId ? `${productId}/${variantId}` : productId
}
