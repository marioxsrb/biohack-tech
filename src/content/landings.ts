/**
 * Advertising landings: one page per product, reached from ads on <slug>.biohack-tech.ro (or /lp/<slug>).
 * Not linked from the site's menu, footer or product grid, and not indexed.
 *
 * Rules for this copy: Romanian, short sentences, no dash punctuation, only facts that are already on
 * the product pages (product-content.ts). No reviews, counters, countdowns or health promises. Prices,
 * names and variants always come from the catalog, never from here.
 */
import type { ProductId, ProductImage } from './catalog'
import type { LandingSlug } from '@/lib/landing-hosts'

import bwSomn from '@/assets/img/balance-wave/result-somn.webp'
import bwCanapea from '@/assets/img/balance-wave/lifestyle-canapea.webp'
import bwBirou from '@/assets/img/balance-wave/audience-birou.webp'
import blBarbat from '@/assets/img/brainlink/lifestyle-barbat.webp'
import blTableta from '@/assets/img/brainlink/pillar-games.webp'
import blMeditatie from '@/assets/img/brainlink/result-meditation.webp'
import glTerasa from '@/assets/img/glasses/lifestyle-terasa.webp'
import glToate from '@/assets/img/glasses/audience-stil.webp'
import glSeara from '@/assets/img/glasses/result-seara.webp'
import bfFemeie from '@/assets/img/brain-flow/lifestyle-femeie.webp'
import bfConsultatie from '@/assets/img/brain-flow/consultatie.webp'
import bfFotoliu from '@/assets/img/brain-flow/fotoliu.webp'

/** Colour mood of a landing. Every theme keeps text contrast at WCAG AA or better. */
export type LandingTheme = {
  /** Page background and text. */
  bg: string
  ink: string
  muted: string
  /** Panels on the page background. */
  panel: string
  line: string
  /** Signal colour: eyebrows, selected option, small marks. */
  accent: string
  /** Hero text sits on a dark photograph (light text) or a light one (dark text). */
  heroTone: 'light' | 'dark'
  /** Which side of the hero photograph stays clear for the text. */
  heroAlign: 'left' | 'right'
}

export type Landing = {
  slug: LandingSlug
  productId: ProductId
  theme: LandingTheme
  meta: { title: string; description: string }
  hero: { eyebrow: string; title: string[]; text: string; image: ProductImage; position?: string }
  /** Three short reasons, each a fact from the product page. */
  points: { title: string; text: string }[]
  story: { title: string; text: string; image: ProductImage }
  steps: { title: string; items: string[] }
  /** A second photograph with one line, before the offer. */
  moment: { title: string; text: string; image: ProductImage }
  offer: { title: string; text: string }
  faqs: { q: string; a: string }[]
}

const photo = (src: ProductImage['src'], alt: string): ProductImage => ({ src, alt, kind: 'photo' })

export const landings: Landing[] = [
  {
    slug: 'calm',
    productId: 'balance-wave',
    theme: { bg: '#120d0b', ink: '#fbf5f1', muted: '#c9b8ae', panel: '#1d1512', line: 'rgb(255 255 255 / 0.12)', accent: '#ff7a66', heroTone: 'light', heroAlign: 'left' },
    meta: {
      title: 'NEUROS Calm: câteva minute de relaxare, acasă',
      description: 'NEUROS Calm se poartă la gât. 5-20 de minute de lumină roșie, apoi se oprește singur. Livrare gratuită în România.',
    },
    hero: {
      eyebrow: 'NEUROS Calm',
      title: ['Seara ta,', 'mai liniștită.'],
      text: 'Un dispozitiv mic, purtat la gât. Alegi durata, te relaxezi, iar el se oprește singur.',
      image: photo(bwSomn, 'Femeie în pat, seara, cu ochii închiși, purtând NEUROS Calm la gât'),
      position: 'object-[70%_50%]',
    },
    points: [
      { title: '5-20 de minute', text: 'Atât durează o ședință. O alegi tu.' },
      { title: 'Se oprește singur', text: 'Nu trebuie să urmărești ceasul.' },
      { title: 'Ghidaj inclus', text: 'Un specialist Biohack Tech te ajută să începi.' },
    ],
    story: {
      title: 'Un moment doar pentru tine.',
      text: 'Îl așezi la gât, pornești lumina roșie și poți citi, medita sau lucra ușor. Lumina se aplică din ambele părți ale gâtului, în zona pe unde trece nervul vag.',
      image: photo(bwCanapea, 'Femeie relaxată pe canapea, purtând NEUROS Calm la gât'),
    },
    steps: { title: 'Cum îl folosești', items: ['Îl așezi la gât.', 'Alegi durata, între 5 și 20 de minute.', 'Te relaxezi. Se oprește singur.'] },
    moment: {
      title: 'Și în pauza de la birou.',
      text: 'Câteva minute între două sarcini, fără să te ridici de la masă.',
      image: photo(bwBirou, 'Femeie la birou, cu ochii închiși, lângă NEUROS Calm'),
    },
    offer: { title: 'NEUROS Calm, livrat acasă.', text: 'Dispozitivul și un specialist care te ajută la început.' },
    faqs: [
      { q: 'Pot să lucrez în timp ce îl port?', a: 'Da. Poți citi, medita sau lucra ușor în timpul ședinței.' },
      { q: 'Mă ajută cineva să încep?', a: 'Da. Un specialist Biohack Tech îți recomandă durata și programul potrivite pentru tine.' },
      { q: 'Este un tratament medical?', a: 'Nu. NEUROS Calm este un produs de wellness. Pentru o afecțiune, vorbește întâi cu medicul tău.' },
    ],
  },
  {
    slug: 'focus',
    productId: 'brainlink-pro',
    theme: { bg: '#f4f8fa', ink: '#0b1316', muted: '#4d5c63', panel: '#ffffff', line: '#dce3e6', accent: '#0e7490', heroTone: 'dark', heroAlign: 'left' },
    meta: {
      title: 'NEUROS Focus: antrenează-ți atenția prin joc',
      description: 'O cască ușoară și peste 10 jocuri pe tabletă, pe care le controlezi prin atenție. Livrare gratuită în România.',
    },
    hero: {
      eyebrow: 'NEUROS Focus',
      title: ['Atenția ta,', 'la antrenament.'],
      text: 'Pui casca, deschizi aplicația pe tabletă și joci. Jocul înaintează când ești atent.',
      image: photo(blBarbat, 'Bărbat relaxat, cu ochii închiși, purtând casca NEUROS Focus'),
      position: 'object-[65%_50%]',
    },
    points: [
      { title: 'Peste 10 jocuri', text: 'Și meditații ghidate, în aplicația Neuros Game.' },
      { title: 'Feedback pe loc', text: 'Vezi în timp real cât de atent sau relaxat ești.' },
      { title: 'Progres salvat', text: 'Fiecare sesiune rămâne în aplicație.' },
    ],
    story: {
      title: 'Cum știe casca?',
      text: 'Trei senzori mici citesc semnalele electrice foarte slabe ale creierului (EEG). Aplicația le transformă în joc. Casca recunoaște stări, precum concentrarea și relaxarea. Gândurile rămân ale tale.',
      image: photo(blTableta, 'Tânăr pe canapea, purtând NEUROS Focus și jucând pe tabletă'),
    },
    steps: { title: 'Cum o folosești', items: ['Pui casca și o pornești.', 'O conectezi la tabletă, prin Bluetooth.', 'Alegi un joc sau o meditație.'] },
    moment: {
      title: 'Și pentru momentele de liniște.',
      text: 'Meditația devine mai ușor de urmărit când vezi cât de relaxat ești.',
      image: photo(blMeditatie, 'Femeie meditând în grădină, purtând NEUROS Focus'),
    },
    offer: { title: 'NEUROS Focus, gata de joc.', text: 'Casca și aplicația Neuros Game. Ai nevoie de o tabletă.' },
    faqs: [
      { q: 'Am nevoie de tabletă?', a: 'Da. Aplicația Neuros Game rulează pe tabletă, iar casca se conectează prin Bluetooth.' },
      { q: 'Cât ține bateria?', a: 'Până la 4 ore, după o oră de încărcare.' },
      { q: 'Mă ajută cineva să încep?', a: 'Da. Un specialist îți recomandă jocurile și programul potrivite pentru ce vrei să obții.' },
    ],
  },
  {
    slug: 'amber',
    productId: 'ochelari-biohack',
    theme: { bg: '#fbf6ee', ink: '#1d1409', muted: '#6b5842', panel: '#ffffff', line: '#eadfce', accent: '#a15c07', heroTone: 'dark', heroAlign: 'left' },
    meta: {
      title: 'NEUROS Amber: ochelari pentru ecrane, în patru rame',
      description: 'Ochelari cu filtru pentru lumina albastră a ecranelor. Cat eye sau unisex pătrat, în negru, bej sau maro. Livrare gratuită în România.',
    },
    hero: {
      eyebrow: 'NEUROS Amber',
      title: ['Ecranele,', 'într-o lumină mai caldă.'],
      text: 'Lentile de culoarea chihlimbarului, care filtrează lumina albastră a ecranelor. O ramă ușoară, pentru toată ziua.',
      image: photo(glTerasa, 'Femeie pe o terasă, la apus, purtând NEUROS Amber cat eye bej'),
      position: 'object-[72%_40%]',
    },
    points: [
      { title: 'Filtru pentru lumina albastră', text: 'De la monitor, telefon și becuri LED.' },
      { title: 'Patru rame', text: 'Cat eye sau unisex pătrat, în trei culori.' },
      { title: 'Ușori', text: 'Făcuți pentru purtat toată ziua.' },
    ],
    story: {
      title: 'Patru rame. Același filtru.',
      text: 'Alegi silueta și culoarea. Lentilele sunt aceleași în toate modelele.',
      image: photo(glToate, 'Cele patru rame NEUROS Amber, așezate pe o masă'),
    },
    steps: { title: 'Când îi porți', items: ['La birou, în fața monitorului.', 'Seara, cu telefonul sau laptopul.', 'Oriunde lucrezi cu ecrane.'] },
    moment: {
      title: 'Și seara, cu telefonul în mână.',
      text: 'Lumina ecranelor devine mai blândă înainte de somn.',
      image: photo(glSeara, 'Femeie în pat, seara, citind pe tabletă cu NEUROS Amber'),
    },
    offer: { title: 'Alege-ți rama.', text: 'Același preț pentru toate cele patru rame.' },
    faqs: [
      { q: 'Când îi port?', a: 'La birou, în fața ecranelor, și seara, când folosești telefonul sau laptopul.' },
      { q: 'Diferă lentilele între rame?', a: 'Nu. Filtrul este același în toate cele patru modele.' },
      { q: 'Pot să îi returnez?', a: 'Da, în 14 zile de la primire.' },
    ],
  },
  {
    slug: 'brain-flow',
    productId: 'brain-flow',
    theme: { bg: '#ffffff', ink: '#101418', muted: '#56616a', panel: '#f5f3f2', line: '#e6e1df', accent: '#b4232f', heroTone: 'dark', heroAlign: 'left' },
    meta: {
      title: 'NEUROS Flow: cască cu lumină infraroșie, pentru acasă',
      description: 'NEUROS Flow: cască de fotobiomodulare cu lumină infraroșie la 810 nm, cu 1, 4 sau 13 zone. Protocol stabilit cu un specialist. Livrare gratuită în România.',
    },
    hero: {
      eyebrow: 'NEUROS Flow',
      title: ['Lumină infraroșie,', 'în rutina de acasă.'],
      text: 'O cască fără fir, cu LED-uri la 810 nm. Alegi 1, 4 sau 13 zone, iar protocolul îl stabilești cu un specialist.',
      image: photo(bfFemeie, 'Femeie relaxată pe canapea, purtând casca NEUROS Flow'),
      position: 'object-[80%_40%]',
    },
    points: [
      { title: '1, 4 sau 13 zone', text: 'Aceeași cască. Diferă câte zone poți activa.' },
      { title: 'Protocolul tău', text: 'Zone, durată și frecvență, setate cu un specialist.' },
      { title: 'Fără fir', text: 'Baterie reîncărcabilă și telecomandă inclusă.' },
    ],
    story: {
      title: 'Nu începi singur.',
      text: 'La consultația de început, un specialist Biohack Tech stabilește cu tine zonele, durata și frecvența ședințelor. Protocolul îl revizuiți periodic, împreună.',
      image: photo(bfConsultatie, 'Consultație Biohack Tech: specialistul arată protocolul pe tabletă'),
    },
    steps: { title: 'Cum o folosești', items: ['Stabilești protocolul cu specialistul.', 'Pui casca și confirmi zonele pe telecomandă.', 'Pornești sesiunea. Casca se oprește la final.'] },
    moment: {
      title: 'La ora aleasă de tine.',
      text: 'Ședințele se fac acasă, în fotoliu sau pe canapea.',
      image: photo(bfFotoliu, 'Femeie într-un fotoliu, cu o cană în mână, lângă casca NEUROS Flow'),
    },
    offer: { title: 'Alege configurația.', text: 'Casca și tehnologia sunt aceleași. Diferă numărul de zone pe care le poți activa în același protocol.' },
    faqs: [
      { q: 'Ce diferă între configurații?', a: 'Casca și tehnologia sunt aceleași. Diferă câte zone poți activa în același protocol: 1, 4 sau 13.' },
      { q: 'Cine stabilește protocolul?', a: 'Un specialist Biohack Tech, la consultația de început. Împreună alegeți zonele, durata și frecvența ședințelor.' },
      { q: 'Este un tratament medical?', a: 'Nu. NEUROS Flow este un produs de wellness. Dacă ai o afecțiune sau urmezi un tratament, vorbește întâi cu medicul tău.' },
    ],
  },
]

export const getLanding = (slug: string) => landings.find((l) => l.slug === slug)
