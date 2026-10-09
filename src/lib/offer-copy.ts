/**
 * What the customer reads about an offer, from its progress (`promotionProgress`). One place, so the
 * cart, the checkout, the landing selector and the pickers say the same thing at the same quantity.
 *
 * NEUROS Amber 2+1 at any quantity (3 → 1 free, 6 → 2, 9 → 3...):
 *   before the first free pair: how many pairs are missing;
 *   once earned: the free pairs and the saving, quietly the distance to the next one, and only when the
 *   next free pair is one pair away does it become a visible prompt again.
 */
import type { Locale } from '@/i18n/locales'
import { getProduct } from '@/content/catalog'
import { formatLei } from './money'
import type { PromotionProgress } from './promotions'

export type OfferCopy = {
  /** 'discover': nothing yet; 'progress': working towards the first reward; 'active': earned. */
  tone: 'discover' | 'progress' | 'active'
  headline: string
  detail?: string
  /** A visible prompt for the next step (one unit away). */
  nudge?: string
  /** A quiet line about the next step (more than one unit away). */
  quiet?: string
}

const pairs = (n: number) => (n === 1 ? 'o pereche' : `${n} perechi`)

export function amberCopy(p: Pick<PromotionProgress, 'units' | 'freeUnits' | 'untilNext' | 'savedMinor'> | null, locale: Locale = 'ro'): OfferCopy {
  if (locale === 'en') return amberCopyEn(p)
  if (!p || p.units === 0) return { tone: 'discover', headline: 'Alege 3 perechi. Plătești 2.' }
  if (p.freeUnits === 0) {
    return p.untilNext === 1
      ? { tone: 'progress', headline: 'Mai alege 1 pereche. A treia este gratuită.' }
      : { tone: 'progress', headline: `Mai alege ${p.untilNext} perechi pentru 2+1.` }
  }
  const headline = p.freeUnits === 1 ? '2+1 activ' : `${p.freeUnits} perechi gratuite`
  const detail = `Economisești ${formatLei(p.savedMinor)}.`
  if (p.untilNext === 1) return { tone: 'active', headline, detail, nudge: 'Mai adaugă 1 pereche și primești încă una gratuită.' }
  if (p.untilNext < 3) return { tone: 'active', headline, detail, quiet: `Încă ${pairs(p.untilNext)} până la următoarea pereche gratuită.` }
  return { tone: 'active', headline, detail }
}

const pairsEn = (n: number) => (n === 1 ? '1 pair' : `${n} pairs`)

function amberCopyEn(p: Pick<PromotionProgress, 'units' | 'freeUnits' | 'untilNext' | 'savedMinor'> | null): OfferCopy {
  if (!p || p.units === 0) return { tone: 'discover', headline: 'Choose 3 pairs. Pay for 2.' }
  if (p.freeUnits === 0) {
    return p.untilNext === 1
      ? { tone: 'progress', headline: 'Add 1 more pair. The third one is free.' }
      : { tone: 'progress', headline: `Add ${p.untilNext} more pairs for 3 for 2.` }
  }
  const headline = p.freeUnits === 1 ? '3 for 2 applied' : `${p.freeUnits} free pairs`
  const detail = `You save ${formatLei(p.savedMinor)}.`
  if (p.untilNext === 1) return { tone: 'active', headline, detail, nudge: 'Add 1 more pair and get another one free.' }
  if (p.untilNext < 3) return { tone: 'active', headline, detail, quiet: `${pairsEn(p.untilNext)} more until the next free pair.` }
  return { tone: 'active', headline, detail }
}

type BundleProgress = Pick<PromotionProgress, 'units' | 'untilNext' | 'savedMinor' | 'active' | 'percent' | 'nextPercent' | 'productId'> | null

const nameOf = (id: string | undefined, locale: Locale) => (id ? (getProduct(id, locale)?.name ?? '') : '')
const together = (n: number, en: boolean) => (en ? (n === 2 ? 'both' : n === 3 ? 'all three' : `all ${n}`) : n === 2 ? 'ambele' : n === 3 ? 'toate trei' : `toate ${n}`)

/**
 * The quantity discount, counted per product: 2 units of the same product get 10%, 3 or more get 20%,
 * on that product only. Each product in the cart has its own line, named.
 */
export function bundleCopy(p: BundleProgress, locale: Locale = 'ro'): OfferCopy {
  const en = locale === 'en'
  if (!p || p.units === 0) return { tone: 'discover', headline: en ? 'Take 2 of the same product for 10% off, or 3 for 20% off.' : 'Iei 2 bucăți din același produs: 10% reducere. Iei 3: 20%.' }
  const name = nameOf(p.productId, locale)
  const target = p.units + p.untilNext
  if (p.active) {
    const headline = en ? `${p.percent}% off your ${name} is applied.` : `Reducerea de ${p.percent}% la ${name} este activă.`
    const detail = en ? `You save ${formatLei(p.savedMinor)}.` : `Economisești ${formatLei(p.savedMinor)}.`
    if (!p.nextPercent) return { tone: 'active', headline, detail }
    if (p.untilNext === 1) return { tone: 'active', headline, detail, nudge: en ? `Add one more ${name} and get ${p.nextPercent}% off ${together(target, true)}.` : `Mai adaugă încă un ${name} și primești ${p.nextPercent}% la ${together(target, false)}.` }
    return { tone: 'active', headline, detail, quiet: en ? `${p.untilNext} more ${name} for ${p.nextPercent}% off.` : `Încă ${p.untilNext} ${name} până la ${p.nextPercent}% reducere.` }
  }
  return {
    tone: 'progress',
    headline: p.untilNext === 1
      ? en ? `Add one more ${name} and get ${p.nextPercent}% off ${together(target, true)}.` : `Mai adaugă încă un ${name} și primești ${p.nextPercent}% la ${together(target, false)}.`
      : en ? `Add ${p.untilNext} more ${name} for ${p.nextPercent}% off.` : `Mai adaugă încă ${p.untilNext} ${name} pentru ${p.nextPercent}% reducere.`,
  }
}
