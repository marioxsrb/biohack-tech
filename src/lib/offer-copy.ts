/**
 * What the customer reads about an offer, from its progress (`promotionProgress`). One place, so the
 * cart, the checkout, the landing selector and the pickers say the same thing at the same quantity.
 *
 * NEUROS Amber 2+1 at any quantity (3 → 1 free, 6 → 2, 9 → 3...):
 *   before the first free pair: how many pairs are missing;
 *   once earned: the free pairs and the saving, quietly the distance to the next one, and only when the
 *   next free pair is one pair away does it become a visible prompt again.
 */
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

export function amberCopy(p: Pick<PromotionProgress, 'units' | 'freeUnits' | 'untilNext' | 'savedMinor'> | null): OfferCopy {
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

export function bundleCopy(p: Pick<PromotionProgress, 'units' | 'untilNext' | 'savedMinor' | 'active'> | null): OfferCopy {
  if (!p || p.units === 0) return { tone: 'discover', headline: 'Alege 3 produse. Primești 20% reducere.' }
  if (p.active) return { tone: 'active', headline: 'Reducerea de 20% este activă', detail: `Economisești ${formatLei(p.savedMinor)}.` }
  return p.untilNext === 1
    ? { tone: 'progress', headline: 'Mai alege 1 produs pentru 20% reducere.' }
    : { tone: 'progress', headline: `Mai alege ${p.untilNext} produse pentru 20% reducere.` }
}
