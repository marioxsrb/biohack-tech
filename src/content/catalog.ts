/**
 * Commerce catalog: everything the cart, checkout and API need about a product.
 * Storytelling (benefits, steps, specs, FAQ) lives in product-content.ts so the
 * cart's client bundle stays small. Prices live in config/prices.ts.
 *
 * Naming: NEUROS is the maker (the neck device already carries the NEUROS logo; the
 * headset's app is Neuros Game). Each product is NEUROS + one short word for what it's for:
 * Calm, Focus, Amber. Biohack Tech is the store. Internal ids stay unchanged so carts
 * saved before the rename still resolve.
 */
import type { StaticImageData } from 'next/image'
import { PRICES_RON } from '@/config/prices'

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
  id: string
  /** Option values, keyed by option id (e.g. { model: 'cat-eye', culoare: 'negru' }). */
  options: Record<string, string>
  images: ProductImage[]
}

export type ProductOption = {
  id: string
  label: string
  values: { id: string; label: string; swatch?: string }[]
}

export type ProductId = 'ochelari-biohack' | 'balance-wave' | 'brainlink-pro'

export type Product = {
  id: ProductId
  /** URL segment. */
  slug: string
  brand: 'NEUROS'
  /** The one-word name: Calm, Focus, Amber. */
  model: string
  /** Full customer-facing name: "NEUROS Calm". */
  name: string
  /** What kind of object it is, in plain words. */
  kind: string
  /** What it's for: "Pentru relaxare". */
  purpose: string
  /** One plain sentence. */
  tagline: string
  /** Price in bani, VAT included. null = no approved price in lei yet (not purchasable). */
  price: number | null
  /** The product on its own: listings, cart, popup, menu. */
  cutout: ProductImage
  /** The product in use: sharing image and editorial sections. */
  lifestyle: ProductImage
  /** Gallery when the product has no variants. Order is deliberate: product, in use, angles, details. */
  images: ProductImage[]
  options?: ProductOption[]
  variants?: Variant[]
  /** Includes an onboarding consultation with a specialist (stated on the source site). */
  guidance: boolean
}

const cut = (src: StaticImageData, alt: string, bleed?: 'bottom'): ProductImage => ({ src, alt, kind: 'cutout', bleed })
const photo = (src: StaticImageData, alt: string): ProductImage => ({ src, alt, kind: 'photo' })

/** Display order. Calm is the lead product on the source site. */
export const products: Product[] = [
  {
    id: 'balance-wave',
    slug: 'calm',
    brand: 'NEUROS',
    model: 'Calm',
    name: 'NEUROS Calm',
    kind: 'Dispozitiv purtat la gât',
    purpose: 'Pentru relaxare',
    tagline: 'Se poartă la gât. Câteva minute de lumină roșie, apoi se oprește singur.',
    price: PRICES_RON['balance-wave'],
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
    purpose: 'Pentru focus',
    tagline: 'O cască ușoară și jocuri pe tabletă, pe care le controlezi prin atenție.',
    price: PRICES_RON['brainlink-pro'],
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
    price: PRICES_RON['ochelari-biohack'],
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
    guidance: false,
  },
]

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id)
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug)
}

export function productHref(p: Product): string {
  return `/products/${p.slug}`
}

export function isPurchasable(p: Product): p is Product & { price: number } {
  return p.price !== null
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

/** Validates a cart line against the catalog. Returns null for unknown products or variants. */
export function resolveLine(productId: string, variantId?: string) {
  const product = getProduct(productId)
  if (!product) return null
  if (product.variants?.length) {
    const variant = getVariant(product, variantId)
    return variant ? { product, variant } : null
  }
  return variantId ? null : { product, variant: undefined }
}
