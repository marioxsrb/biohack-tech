/**
 * Commerce catalog: everything the cart, checkout and API need about a product.
 * Storytelling (audience, steps, specs, FAQ) lives in product-content.ts so the
 * cart's client bundle stays small.
 *
 * Source of truth: client ZIP "Biohack-Tech_Structura_si_Copy.docx", 25 Sep 2026.
 */
import type { StaticImageData } from 'next/image'
import type { Money } from '@/lib/money'

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
import glSqNegru5 from '@/assets/img/glasses/patrat-negru-5.webp'
import glSqMaro1 from '@/assets/img/glasses/patrat-maro-1.webp'
import glSqMaro2 from '@/assets/img/glasses/patrat-maro-2.webp'
import glSqMaro3 from '@/assets/img/glasses/patrat-maro-3.webp'
import glSqMaro4 from '@/assets/img/glasses/patrat-maro-4.webp'
import glTerasa from '@/assets/img/glasses/lifestyle-terasa.webp'
import glStil from '@/assets/img/glasses/audience-stil.webp'

import bwCutie from '@/assets/img/balance-wave/cutie.webp'
import bwActiv from '@/assets/img/balance-wave/dispozitiv-activ.webp'
import bwDispozitiv from '@/assets/img/balance-wave/dispozitiv.webp'
import bwCanapea from '@/assets/img/balance-wave/lifestyle-canapea.webp'
import bwBirou from '@/assets/img/balance-wave/lifestyle-birou.webp'

import blCasca from '@/assets/img/brainlink/casca.webp'
import blLateral from '@/assets/img/brainlink/casca-lateral.webp'
import blGeanta from '@/assets/img/brainlink/casca-geanta.webp'
import blRelaxare from '@/assets/img/brainlink/lifestyle-relaxare.webp'
import blLucru from '@/assets/img/brainlink/audience-lucru.webp'

/**
 * `cutout`: transparent product shot, shown whole on a neutral stage.
 * `studio`: product on a white studio background, blended onto the stage.
 * `photo`: lifestyle photography, fills its frame.
 */
export type ImageKind = 'cutout' | 'studio' | 'photo'
export type ProductImage = {
  src: StaticImageData
  alt: string
  kind: ImageKind
  /** The product is cropped at this edge in the source photo; frames anchor it there so the crop reads as intentional. */
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
  /** URL segment. Kept identical to the live site so existing links and rankings survive. */
  slug: string
  name: string
  /** What it's for, in two or three words ("Pentru relaxare"). */
  purpose: string
  /** One plain sentence: what it is and what it does for you. */
  tagline: string
  price: Money
  /** The product on its own, used on listings, the cart and the menu. */
  cutout: ProductImage
  /** The product in use, used in editorial sections. */
  lifestyle: ProductImage
  /** Gallery when the product has no variants. */
  images: ProductImage[]
  options?: ProductOption[]
  variants?: Variant[]
  /** Includes an onboarding consultation with a specialist (stated on the source site). */
  guidance: boolean
}

const glasses = (src: StaticImageData, alt: string): ProductImage => ({ src, alt, kind: 'cutout' })

/** Display order. Balance Wave is the lead product on the source site. */
export const products: Product[] = [
  {
    id: 'balance-wave',
    slug: 'balancewave',
    name: 'Balance Wave',
    purpose: 'Pentru relaxare',
    tagline: 'Se poartă la gât. Câteva minute de lumină roșie, când ai nevoie de liniște.',
    price: { amount: 121000, currency: 'EUR' },
    cutout: { src: bwActiv, alt: 'Dispozitivul Balance Wave cu luminile roșii aprinse', kind: 'cutout', bleed: 'bottom' },
    lifestyle: { src: bwCanapea, alt: 'Femeie relaxată pe canapea, purtând Balance Wave la gât', kind: 'photo' },
    images: [
      { src: bwActiv, alt: 'Dispozitivul Balance Wave cu luminile roșii aprinse', kind: 'cutout', bleed: 'bottom' },
      { src: bwCutie, alt: 'Balance Wave lângă cutia produsului', kind: 'cutout' },
      { src: bwDispozitiv, alt: 'Balance Wave, partea exterioară a dispozitivului', kind: 'cutout' },
      { src: bwCanapea, alt: 'Femeie relaxată pe canapea, purtând Balance Wave', kind: 'photo' },
      { src: bwBirou, alt: 'Femeie la birou, purtând Balance Wave la gât', kind: 'photo' },
    ],
    guidance: true,
  },
  {
    id: 'brainlink-pro',
    slug: 'brainlink',
    name: 'BrainLink Pro',
    purpose: 'Pentru focus',
    tagline: 'O cască ușoară și jocuri pe tabletă pe care le controlezi cu atenția.',
    price: { amount: 249000, currency: 'RON' },
    cutout: { src: blCasca, alt: 'Casca BrainLink Pro, vedere din unghi', kind: 'studio' },
    lifestyle: { src: blRelaxare, alt: 'Femeie relaxată, cu ochii închiși, purtând casca BrainLink Pro', kind: 'photo' },
    images: [
      { src: blCasca, alt: 'Casca BrainLink Pro, vedere din unghi', kind: 'studio' },
      { src: blLateral, alt: 'Casca BrainLink Pro, vedere laterală cu senzorul de ureche', kind: 'studio' },
      { src: blGeanta, alt: 'Casca BrainLink Pro lângă geanta de transport', kind: 'studio' },
      { src: blRelaxare, alt: 'Femeie relaxată purtând casca BrainLink Pro', kind: 'photo' },
      { src: blLucru, alt: 'Bărbat la laptop purtând casca BrainLink Pro', kind: 'photo' },
    ],
    guidance: true,
  },
  {
    id: 'ochelari-biohack',
    slug: 'glasses',
    name: 'Ochelari Biohack',
    purpose: 'Pentru ecrane',
    tagline: 'Filtrează lumina albastră a ecranelor. Pentru zile lungi și seri liniștite.',
    price: { amount: 6000, currency: 'EUR' },
    cutout: glasses(glCatNegru1, 'Ochelari Biohack cat eye, ramă neagră, lentile galbene'),
    lifestyle: { src: glTerasa, alt: 'Femeie pe o terasă, purtând Ochelari Biohack', kind: 'photo' },
    images: [{ src: glStil, alt: 'Cele patru modele de Ochelari Biohack', kind: 'photo' }],
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
          glasses(glCatNegru1, 'Ochelari Biohack cat eye negru, vedere din față'),
          glasses(glCatNegru2, 'Ochelari Biohack cat eye negru, vedere din unghi'),
          glasses(glCatNegru3, 'Ochelari Biohack cat eye negru, vedere de sus'),
          glasses(glCatNegru4, 'Ochelari Biohack cat eye negru, vedere din spate'),
          glasses(glCatNegru5, 'Ochelari Biohack cat eye negru, vedere laterală'),
        ],
      },
      {
        id: 'cat-eye-bej',
        options: { model: 'cat-eye', culoare: 'bej' },
        images: [
          glasses(glCatBej1, 'Ochelari Biohack cat eye bej, vedere din față'),
          glasses(glCatBej2, 'Ochelari Biohack cat eye bej, vedere din unghi'),
          glasses(glCatBej3, 'Ochelari Biohack cat eye bej, vedere laterală'),
          glasses(glCatBej4, 'Ochelari Biohack cat eye bej, vedere din spate'),
        ],
      },
      {
        id: 'patrat-negru',
        options: { model: 'patrat', culoare: 'negru' },
        images: [
          glasses(glSqNegru1, 'Ochelari Biohack unisex pătrat negru, vedere din față'),
          glasses(glSqNegru3, 'Ochelari Biohack unisex pătrat negru, vedere din unghi'),
          glasses(glSqNegru2, 'Ochelari Biohack unisex pătrat negru, vedere laterală'),
          glasses(glSqNegru4, 'Ochelari Biohack unisex pătrat negru, vedere din spate'),
          glasses(glSqNegru5, 'Ochelari Biohack unisex pătrat negru, brațele deschise'),
        ],
      },
      {
        id: 'patrat-maro',
        options: { model: 'patrat', culoare: 'maro' },
        images: [
          glasses(glSqMaro1, 'Ochelari Biohack unisex pătrat maro, vedere din față'),
          glasses(glSqMaro2, 'Ochelari Biohack unisex pătrat maro, vedere din unghi'),
          glasses(glSqMaro3, 'Ochelari Biohack unisex pătrat maro, vedere laterală'),
          glasses(glSqMaro4, 'Ochelari Biohack unisex pătrat maro, vedere din spate'),
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
