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

const produse = (n: number) => (n === 1 ? '1 produs' : `${n} produse`)
const productsEn = (n: number) => (n === 1 ? '1 product' : `${n} products`)

type BundleProgress = Pick<PromotionProgress, 'units' | 'untilNext' | 'savedMinor' | 'active' | 'percent' | 'nextPercent'> | null

/** 10% at 2 eligible products, 20% from 3: the first step is a prompt, 10% is earned with a nudge to 20%. */
export function bundleCopy(p: BundleProgress, locale: Locale = 'ro'): OfferCopy {
  const en = locale === 'en'
  if (!p || p.units === 0) return { tone: 'discover', headline: en ? 'Choose 2 products for 10% off, or 3 for 20% off.' : 'Alege 2 produse pentru 10% sau 3 pentru 20% reducere.' }
  if (p.active) {
    const headline = en ? `Your ${p.percent}% discount is applied.` : `Reducerea de ${p.percent}% este activă.`
    const detail = en ? `You save ${formatLei(p.savedMinor)}.` : `Economisești ${formatLei(p.savedMinor)}.`
    if (!p.nextPercent) return { tone: 'active', headline, detail }
    if (p.untilNext === 1) return { tone: 'active', headline, detail, nudge: en ? `Add 1 more product and get ${p.nextPercent}% off all of them.` : `Mai adaugă 1 produs și primești ${p.nextPercent}% la toate.` }
    return { tone: 'active', headline, detail, quiet: en ? `${productsEn(p.untilNext)} more until ${p.nextPercent}% off.` : `Încă ${produse(p.untilNext)} până la ${p.nextPercent}% reducere.` }
  }
  return { tone: 'progress', headline: en ? `Add ${productsEn(p.untilNext)} for ${p.nextPercent}% off.` : `Mai alege ${produse(p.untilNext)} pentru ${p.nextPercent}% reducere.` }
}
