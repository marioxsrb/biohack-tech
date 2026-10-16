/**
 * Advertising landings: one page per product, reached from ads on <slug>.biohack-tech.ro (or /lp/<slug>).
 * Not linked from the site's menu, footer or product grid, and not indexed.
 *
 * This file holds what identifies each landing (slug, product, colours, metadata) and its product FAQ.
 * The story of each page (sections and copy) lives in components/landing/pages/*, because each product
 * is told differently. Copy rules everywhere: Romanian, short sentences, no dash punctuation, only facts
 * already on the product pages (product-content.ts). No reviews, counters, countdowns or health promises.
 * Prices, names and variants always come from the catalog.
 */
import type { ProductId } from './catalog'
import type { LandingSlug } from '@/lib/landing-hosts'

/**
 * A landing's colours. All of them use the main site's palette (mist page, white panels, ink text, the
 * site's lines and red button); only `accent` differs, for kickers and small details. Product personality
 * comes from photographs, copy and layout.
 * Text contrast stays at WCAG AA or better.
 */
export type LandingTheme = {
  bg: string
  ink: string
  muted: string
  /** Panels on the page background. */
  panel: string
  line: string
  /** Signal colour: kickers, selected option, small marks. */
  accent: string
}

export type Landing = {
  slug: LandingSlug
  productId: ProductId
  theme: LandingTheme
  meta: { title: string; description: string }
  /** `buy`: a question about buying (returns, the offer). The presentation pages leave these out. */
  faqs: { q: string; a: string; buy?: true }[]
}

export const landings: Landing[] = [
  {
    slug: 'calm',
    productId: 'balance-wave',
    theme: { bg: '#f2f5f6', ink: '#0b1316', muted: '#4b5960', panel: '#ffffff', line: '#dce3e6', accent: '#0e7490' },
    meta: {
      title: 'NEUROS Calm: liniște seara și somn mai lin',
      description: 'NEUROS Calm te ajută să te relaxezi în câteva minute. Mulți utilizatori simt mai puțin stres și un somn mai lin. Livrare gratuită în România.',
    },
    faqs: [
      { q: 'Cât durează o ședință?', a: 'Câteva minute de liniște. Îl pornești dintr-un singur buton, iar la final se oprește singur.' },
      { q: 'Pot să lucrez sau să citesc în timp ce îl port?', a: 'Da. Poți citi, medita sau lucra ușor, în timp ce te relaxezi.' },
      { q: 'Cum încep?', a: 'Îl încarci, îl așezi la gât și îl pornești. Câteva minute de liniște, apoi se oprește singur. Pentru orice întrebare, ne scrii sau ne suni.' },
      { q: 'Ce fel de produs este?', a: 'Un produs de wellness, care susține relaxarea. Mulți utilizatori simt mai mult calm. Pentru o afecțiune, cere întâi sfatul medicului.' },
      { q: 'Pot să îl returnez?', a: 'Da. Ai 14 zile de la primire să te răzgândești. Garanția este de 2 ani.', buy: true },
    ],
  },
  {
    slug: 'focus',
    productId: 'brainlink-pro',
    theme: { bg: '#f2f5f6', ink: '#0b1316', muted: '#4b5960', panel: '#ffffff', line: '#dce3e6', accent: '#0e7490' },
    meta: {
      title: 'NEUROS Focus: mai multă concentrare, prin joc',
      description: 'NEUROS Focus te ajută să-ți aduni atenția. Mulți utilizatori simt mai mult focus și mai multă energie. Jocuri scurte pe tabletă. Livrare gratuită.',
    },
    faqs: [
      { q: 'Am nevoie de tabletă?', a: 'Da. Jocurile care îți antrenează atenția rulează pe tabletă, în Neuros Game. Casca se leagă prin Bluetooth.' },
      { q: 'Ce citește casca?', a: 'Stări precum concentrarea și relaxarea, ca să te ajute să le recunoști. Are trei senzori EEG. Gândurile rămân ale tale.' },
      { q: 'Cât ține bateria?', a: 'Până la 4 ore, după o oră de încărcare. Ajunge pentru mai multe sesiuni de focus.' },
      { q: 'Ce găsesc în aplicație?', a: 'Peste 10 jocuri și meditații ghidate, care te ajută să-ți antrenezi atenția și calmul. Fiecare sesiune rămâne salvată, ca să-ți vezi progresul.' },
      { q: 'Cum încep?', a: 'Încarci casca, instalezi Neuros Game pe tabletă și o conectezi. Apoi alegi un joc scurt. Pentru întrebări, ne scrii sau ne suni.' },
      { q: 'Pot să o returnez?', a: 'Da. Ai 14 zile de la primire să te răzgândești. Garanția este de 2 ani.', buy: true },
    ],
  },
  {
    slug: 'amber',
    productId: 'ochelari-biohack',
    theme: { bg: '#f5f1ea', ink: '#1b1611', muted: '#6b6156', panel: '#fffdf9', line: '#e5ddd0', accent: '#9a5b13' },
    meta: {
      title: 'NEUROS Amber: seri mai liniștite, 2+1 gratis',
      description: 'NEUROS Amber te ajută să termini ziua mai calm. Lumina ecranelor se simte mai blândă. Patru rame. La trei perechi, una este gratuită.',
    },
    faqs: [
      { q: 'Când îi port?', a: 'La birou, când vrei ochi mai odihniți, și seara, când vrei o lumină mai blândă pe telefon sau laptop.' },
      { q: 'Ce diferă între rame?', a: 'Forma și culoarea. Confortul e același: lumina ecranelor se simte mai blândă în toate cele patru modele.' },
      { q: 'Cum funcționează 2+1 gratis?', a: 'La fiecare trei perechi din aceeași comandă, una este gratuită. Poți combina ramele. Reducerea apare singură în coș.', buy: true },
      { q: 'Ce rame există?', a: 'Cat eye, în negru sau bej, și unisex pătrat, în negru sau maro. Alegi ce îți place să porți.' },
      { q: 'Pot să îi returnez?', a: 'Da. Ai 14 zile de la primire să te răzgândești. Garanția este de 2 ani.', buy: true },
    ],
  },
]

export const getLanding = (slug: string) => landings.find((l) => l.slug === slug)
