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
  faqs: { q: string; a: string }[]
}

export const landings: Landing[] = [
  {
    slug: 'calm',
    productId: 'balance-wave',
    theme: { bg: '#f2f5f6', ink: '#0b1316', muted: '#4b5960', panel: '#ffffff', line: '#dce3e6', accent: '#0e7490' },
    meta: {
      title: 'NEUROS Calm: câteva minute de relaxare, acasă',
      description: 'NEUROS Calm se poartă la gât. 5-20 de minute de lumină roșie, apoi se oprește singur. Livrare gratuită în România.',
    },
    faqs: [
      { q: 'Cât durează o ședință?', a: 'Între 5 și 20 de minute. Alegi tu durata, iar dispozitivul se oprește singur.' },
      { q: 'Pot să lucrez sau să citesc în timp ce îl port?', a: 'Da. Poți citi, medita sau lucra ușor în timpul ședinței.' },
      { q: 'Pot regla intensitatea?', a: 'Da. Intensitatea se reglează pe trepte.' },
      { q: 'Mă ajută cineva să încep?', a: 'Da. Un specialist Biohack Tech îți recomandă durata și programul potrivite pentru tine.' },
      { q: 'Este un tratament medical?', a: 'Nu. NEUROS Calm este un produs de wellness. Pentru o afecțiune, vorbește întâi cu medicul tău.' },
      { q: 'Pot să îl returnez?', a: 'Da. Ai 14 zile de la primire să te răzgândești.' },
    ],
  },
  {
    slug: 'focus',
    productId: 'brainlink-pro',
    theme: { bg: '#f2f5f6', ink: '#0b1316', muted: '#4b5960', panel: '#ffffff', line: '#dce3e6', accent: '#0e7490' },
    meta: {
      title: 'NEUROS Focus: antrenează-ți atenția prin joc',
      description: 'O cască ușoară și peste 10 jocuri pe tabletă, pe care le controlezi prin atenție. Livrare gratuită în România.',
    },
    faqs: [
      { q: 'Am nevoie de tabletă?', a: 'Da. Aplicația Neuros Game rulează pe tabletă, iar casca se conectează prin Bluetooth.' },
      { q: 'Ce citește casca?', a: 'Stări precum concentrarea și relaxarea, prin trei senzori EEG. Gândurile rămân ale tale.' },
      { q: 'Cât ține bateria?', a: 'Până la 4 ore, după o oră de încărcare.' },
      { q: 'Ce găsesc în aplicație?', a: 'Peste 10 jocuri și meditații ghidate. Fiecare sesiune rămâne salvată, ca să îți vezi progresul.' },
      { q: 'Mă ajută cineva să încep?', a: 'Da. Un specialist îți recomandă jocurile și programul potrivite pentru ce vrei să obții.' },
      { q: 'Pot să o returnez?', a: 'Da. Ai 14 zile de la primire să te răzgândești.' },
    ],
  },
  {
    slug: 'amber',
    productId: 'ochelari-biohack',
    theme: { bg: '#f2f5f6', ink: '#0b1316', muted: '#4b5960', panel: '#ffffff', line: '#dce3e6', accent: '#0e7490' },
    meta: {
      title: 'NEUROS Amber: ochelari pentru ecrane, 2+1 gratis',
      description: 'Ochelari cu lentile chihlimbar, care filtrează lumina albastră a ecranelor. Patru rame. La trei perechi, una e gratuită.',
    },
    faqs: [
      { q: 'Când îi port?', a: 'La birou, în fața ecranelor, și seara, când folosești telefonul sau laptopul.' },
      { q: 'Diferă lentilele între rame?', a: 'Nu. Filtrul este același în toate cele patru modele. Alegi doar forma și culoarea.' },
      { q: 'Cum funcționează 2+1 gratis?', a: 'La fiecare trei perechi din aceeași comandă, una este gratuită. Poți combina ramele. Reducerea apare singură în coș.' },
      { q: 'Ce rame există?', a: 'Cat eye, în negru sau bej, și unisex pătrat, în negru sau maro.' },
      { q: 'Pot să îi returnez?', a: 'Da. Ai 14 zile de la primire să te răzgândești.' },
    ],
  },
  {
    slug: 'brain-flow',
    productId: 'brain-flow',
    theme: { bg: '#f2f5f6', ink: '#0b1316', muted: '#4b5960', panel: '#ffffff', line: '#dce3e6', accent: '#b0202c' },
    meta: {
      title: 'NEUROS Flow: cască cu lumină infraroșie, pentru acasă',
      description: 'NEUROS Flow: cască de fotobiomodulare cu lumină infraroșie la 810 nm, cu 1, 4 sau 13 zone. Protocol stabilit cu un specialist. Livrare gratuită în România.',
    },
    faqs: [
      { q: 'Ce configurație aleg?', a: 'Casca și tehnologia sunt aceleași. Diferă câte zone poți activa în același protocol: 1, 4 sau 13. Dacă nu știi, scrie-ne și alegem împreună.' },
      { q: 'Cine stabilește protocolul?', a: 'Un specialist Biohack Tech, la consultația de început. Împreună alegeți zonele, durata și frecvența ședințelor.' },
      { q: 'Cum se folosește acasă?', a: 'Pui casca, confirmi zonele pe telecomandă și pornești ședința. Casca se oprește la finalul timpului setat.' },
      { q: 'Are fir?', a: 'Nu. Casca are baterie reîncărcabilă și funcționează fără fir.' },
      { q: 'Este un tratament medical?', a: 'Nu. NEUROS Flow este un produs de wellness. Dacă ai o afecțiune sau urmezi un tratament, vorbește întâi cu medicul tău.' },
      { q: 'Pot să o returnez?', a: 'Da. Ai 14 zile de la primire să te răzgândești.' },
    ],
  },
]

export const getLanding = (slug: string) => landings.find((l) => l.slug === slug)
