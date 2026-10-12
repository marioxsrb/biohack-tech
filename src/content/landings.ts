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
 * A landing's colours. All four use the main site's palette (mist page, white panels, ink text, the
 * site's lines and red button); only `accent` differs, for kickers and small details (the site's cyan,
 * or the infrared red of NEUROS Flow). Product personality comes from photographs, copy and layout.
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
      title: 'NEUROS Calm: lumină roșie pentru relaxare, purtată la gât',
      description: 'NEUROS Calm se poartă la gât și aplică lumină roșie și infraroșie în zona nervului vag. Câteva minute de relaxare, acasă. Livrare gratuită în România.',
    },
    faqs: [
      { q: 'Cât durează o ședință?', a: 'Câteva minute. Îl pornești dintr-un singur buton, iar la final se oprește singur.' },
      { q: 'Pot să lucrez sau să citesc în timp ce îl port?', a: 'Da. În timpul ședinței poți citi, medita sau lucra ușor.' },
      { q: 'Mă ajută cineva să încep?', a: 'Da. Un specialist Biohack Tech îți recomandă programul potrivit pentru tine.' },
      { q: 'Ce fel de produs este?', a: 'NEUROS Calm este un produs de wellness. Pentru o afecțiune, cere întâi sfatul medicului.' },
      { q: 'Pot să îl returnez?', a: 'Da. Ai 14 zile de la primire să te răzgândești. Garanția este de 2 ani.', buy: true },
    ],
  },
  {
    slug: 'focus',
    productId: 'brainlink-pro',
    theme: { bg: '#f2f5f6', ink: '#0b1316', muted: '#4b5960', panel: '#ffffff', line: '#dce3e6', accent: '#0e7490' },
    meta: {
      title: 'NEUROS Focus: cască EEG pentru concentrare, prin joc',
      description: 'NEUROS Focus este o cască EEG ușoară, cu peste 10 jocuri pe tabletă controlate prin atenție. Îți antrenezi concentrarea acasă. Livrare gratuită.',
    },
    faqs: [
      { q: 'Am nevoie de tabletă?', a: 'Da. Aplicația Neuros Game rulează pe tabletă, iar casca se conectează prin Bluetooth.' },
      { q: 'Ce citește casca?', a: 'Stări precum concentrarea și relaxarea. Folosește trei senzori EEG. Gândurile rămân ale tale.' },
      { q: 'Cât ține bateria?', a: 'Până la 4 ore, după o oră de încărcare.' },
      { q: 'Ce găsesc în aplicație?', a: 'Peste 10 jocuri și meditații ghidate. Aplicația salvează fiecare sesiune, ca să îți vezi progresul.' },
      { q: 'Mă ajută cineva să încep?', a: 'Da. Un specialist îți recomandă jocurile și programul potrivite pentru ce vrei să obții.' },
      { q: 'Pot să o returnez?', a: 'Da. Ai 14 zile de la primire să te răzgândești. Garanția este de 2 ani.', buy: true },
    ],
  },
  {
    slug: 'amber',
    productId: 'ochelari-biohack',
    theme: { bg: '#f5f1ea', ink: '#1b1611', muted: '#6b6156', panel: '#fffdf9', line: '#e5ddd0', accent: '#9a5b13' },
    meta: {
      title: 'NEUROS Amber: ochelari pentru lumina albastră, 2+1 gratis',
      description: 'Ochelari NEUROS Amber cu lentile chihlimbar, care filtrează lumina albastră a ecranelor. Patru rame. La trei perechi, una este gratuită.',
    },
    faqs: [
      { q: 'Când îi port?', a: 'La birou, în fața ecranelor, și seara, când folosești telefonul sau laptopul.' },
      { q: 'Ce diferă între rame?', a: 'Forma și culoarea. Filtrul este același în toate cele patru modele.' },
      { q: 'Cum funcționează 2+1 gratis?', a: 'La fiecare trei perechi din aceeași comandă, una este gratuită. Poți combina ramele. Reducerea apare singură în coș.', buy: true },
      { q: 'Ce rame există?', a: 'Cat eye, în negru sau bej, și unisex pătrat, în negru sau maro.' },
      { q: 'Pot să îi returnez?', a: 'Da. Ai 14 zile de la primire să te răzgândești. Garanția este de 2 ani.', buy: true },
    ],
  },
  {
    slug: 'brain-flow',
    productId: 'brain-flow',
    theme: { bg: '#f2f5f6', ink: '#0b1316', muted: '#4b5960', panel: '#ffffff', line: '#dce3e6', accent: '#b0202c' },
    meta: {
      title: 'NEUROS Flow: cască cu lumină infraroșie 810 nm, pentru acasă',
      description: 'NEUROS Flow este o cască de fotobiomodulare cu lumină infraroșie la 810 nm, cu 1, 4 sau 13 zone. Protocolul îl stabilești cu un specialist. Livrare gratuită.',
    },
    faqs: [
      { q: 'Ce configurație aleg?', a: 'Casca și tehnologia sunt aceleași. Se schimbă numărul de zone pe care le poți activa în același protocol: 1, 4 sau 13. Scrie-ne și alegem împreună.' },
      { q: 'Cine stabilește protocolul?', a: 'Un specialist Biohack Tech, la consultația de început. Împreună alegeți zonele, durata și frecvența ședințelor.' },
      { q: 'Cum se folosește acasă?', a: 'Pui casca, confirmi zonele pe telecomandă și pornești ședința. Casca se oprește la finalul timpului setat.' },
      { q: 'Cum se alimentează?', a: 'Casca are baterie reîncărcabilă. Te așezi unde vrei.' },
      { q: 'Ce fel de produs este?', a: 'NEUROS Flow este un produs de wellness. Dacă ai o afecțiune sau urmezi un tratament, cere întâi sfatul medicului.' },
      { q: 'Pot să o returnez?', a: 'Da. Ai 14 zile de la primire să te răzgândești. Garanția este de 2 ani.', buy: true },
    ],
  },
]

export const getLanding = (slug: string) => landings.find((l) => l.slug === slug)
