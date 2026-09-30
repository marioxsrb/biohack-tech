/**
 * Homepage copy beyond the hero and the product shelf: why Biohack Tech, the daily-rhythm comparison,
 * the FAQ (short on the homepage, complete on /intrebari-frecvente). Only facts that are already on the
 * product pages, the legal pages or config/site.ts. No testimonials: the source material's six were
 * unverifiable (docs/CONTENT-DECISIONS.md); real ones can be added to `testimonials` with consent.
 */
import type { ProductId, ProductImage } from './catalog'
import { company } from '@/config/company'
import { site, terms } from '@/config/site'

import glSeara from '@/assets/img/glasses/result-seara.webp'

const photo = (src: ProductImage['src'], alt: string): ProductImage => ({ src, alt, kind: 'photo' })

/** Why Biohack Tech: one photograph and three reasons, each a verified fact. */
export const why = {
  title: 'Tehnologie pe care chiar o folosești acasă.',
  image: photo(glSeara, 'Femeie în pat, seara, citind pe tabletă cu ochelarii NEUROS Amber'),
  points: [
    { title: 'Câteva minute, la ora ta', text: 'NEUROS Calm și NEUROS Flow se folosesc în ședințe scurte, acasă. NEUROS Amber se poartă ca orice ochelari.' },
    { title: 'Te ajută un specialist', text: 'Pentru NEUROS Calm, Focus și Flow, un specialist Biohack Tech îți recomandă programul potrivit.' },
    { title: 'Cumperi fără grijă', text: 'Livrare gratuită în România, 14 zile să te răzgândești și garanție de 2 ani.' },
  ],
}

/**
 * "Aceeași zi. Alt ritm.": the same four moments of a day, without and with a deliberate tool. Contexts
 * and uses only (what the product is and how it is used), never an outcome.
 */
export const rhythm = {
  title: 'Aceeași zi. Alt ritm.',
  intro: 'Aceleași momente din zi. Diferența e că ai un instrument făcut pentru fiecare.',
  without: 'Fără o rutină',
  with: 'Cu Biohack Tech în rutină',
  rows: [
    { moment: 'Relaxare', without: 'Te oprești când se termină ziua, nu când alegi tu.', with: 'Seara, 5-20 de minute de lumină roșie cu NEUROS Calm, la aceeași oră.' },
    { moment: 'Atenție', without: 'Concentrarea depinde de ce se întâmplă în jur.', with: 'O sesiune de joc cu NEUROS Focus, care înaintează doar când ești atent.' },
    { moment: 'Ecrane', without: 'Lumina albastră a ecranelor te însoțește până la somn.', with: 'Lentilele chihlimbar NEUROS Amber o filtrează, la birou și seara.' },
    { moment: 'Acasă', without: 'Nu ai un moment dedicat doar ție.', with: 'Ședința NEUROS Flow, după protocolul stabilit cu specialistul.' },
  ],
  note: 'Fiecare om e diferit, la fel și efectele. Produsele sunt de wellness și nu înlocuiesc sfatul medicului.',
}

/**
 * Real customer words, when there are some. Add an entry only with the customer's written consent and a
 * source you can show (email, review platform). The homepage shows the block only when this is not empty.
 */
export type Testimonial = { quote: string; name: string; productId: ProductId; source: string; consentAt: string }
export const testimonials: Testimonial[] = []

export type FaqItem = { q: string; a: string }

/** The homepage keeps only the questions that decide a purchase. All of them are on /intrebari-frecvente. */
export const homeFaq: FaqItem[] = [
  {
    q: 'Cum aleg produsul potrivit?',
    a: 'După ce vrei să schimbi. NEUROS Calm, pentru câteva minute de relaxare. NEUROS Focus, pentru antrenamentul atenției. NEUROS Amber, pentru orele în fața ecranelor. NEUROS Flow, pentru un protocol de lumină infraroșie acasă. Dacă nu ești sigur, scrie-ne și te ajutăm să alegi.',
  },
  {
    q: 'Cum se folosesc?',
    a: 'NEUROS Calm se poartă la gât, 5-20 de minute. NEUROS Focus se conectează prin Bluetooth la o tabletă, unde rulează jocurile. NEUROS Amber se poartă ca orice ochelari. NEUROS Flow se folosește după protocolul stabilit la consultația de început. Pentru Calm, Focus și Flow, un specialist te ajută să începi.',
  },
  {
    q: 'Cum funcționează ofertele?',
    a: 'Cu cel puțin 3 produse NEUROS Calm, NEUROS Focus sau NEUROS Flow în coș, în orice combinație, primești 20% reducere la ele. La NEUROS Amber, la fiecare 3 perechi, una este gratuită. Reducerile se aplică singure în coș și se pot cumula.',
  },
  {
    q: 'Ce diferă între configurațiile NEUROS Flow?',
    a: 'Casca și tehnologia sunt aceleași. Diferă câte zone poți activa în același protocol: 1, 4 sau 13. Fiecare configurație are prețul ei.',
  },
  {
    q: 'Cum plătesc?',
    a: 'Cu cardul, online, prin Stripe (datele cardului nu ajung la noi), sau prin transfer bancar. La transfer, pregătim comanda după ce suma ajunge în cont.',
  },
  {
    q: 'Cât durează livrarea și cum returnez?',
    a: `Livrarea este gratuită în România. Pregătim comanda în ${terms.processingDays} de la confirmarea plății, iar transportul durează de obicei ${terms.transitDays}. După ce primești produsul, ai ${terms.returnDays} zile să te răzgândești.`,
  },
  {
    q: 'Sunt dispozitive medicale?',
    a: 'Sunt produse de wellness, pentru uz zilnic. Nu înlocuiesc sfatul medicului. Dacă ai o afecțiune sau urmezi un tratament, vorbește întâi cu medicul tău.',
  },
]
export type FaqGroup = { title: string; items: FaqItem[] }

export const faq: FaqGroup[] = [
  {
    title: 'Produse',
    items: [
      {
        q: 'Care produs mi se potrivește?',
        a: 'NEUROS Calm, pentru câteva minute de relaxare, seara. NEUROS Focus, pentru antrenamentul atenției prin jocuri pe tabletă. NEUROS Amber, pentru orele în fața ecranelor. NEUROS Flow, pentru un protocol de fotobiomodulare acasă, stabilit cu un specialist. Dacă nu ești sigur, scrie-ne mai jos și te ajutăm să alegi.',
      },
      {
        q: 'Sunt dispozitive medicale?',
        a: 'Sunt produse de wellness, pentru uz zilnic. Nu înlocuiesc sfatul medicului. Dacă ai o afecțiune sau urmezi un tratament, vorbește întâi cu medicul tău.',
      },
      {
        q: 'Mă ajută cineva să încep?',
        a: 'Da. Pentru NEUROS Calm, NEUROS Focus și NEUROS Flow, un specialist Biohack Tech îți recomandă programul potrivit. La NEUROS Flow, protocolul se stabilește la consultația de început.',
      },
      {
        q: 'Ce diferă între configurațiile NEUROS Flow?',
        a: 'Casca și tehnologia sunt aceleași. Diferă câte zone poți activa în același protocol: 1, 4 sau 13. Fiecare configurație are prețul ei, afișat pe pagina produsului.',
      },
    ],
  },
  {
    title: 'Oferte',
    items: [
      {
        q: 'Cum funcționează reducerea de 20%?',
        a: 'Când ai în coș cel puțin 3 produse NEUROS Calm, NEUROS Focus sau NEUROS Flow, în orice combinație, primești 20% reducere la ele. Pot fi și trei bucăți din același produs. NEUROS Amber nu intră în calcul. Reducerea apare automat în coș.',
      },
      {
        q: 'Cum funcționează 2+1 gratis la NEUROS Amber?',
        a: 'La fiecare 3 perechi NEUROS Amber din aceeași comandă, una este gratuită. Poți combina ramele. Se aplică automat în coș și se poate cumula cu reducerea de 20% la celelalte produse.',
      },
    ],
  },
  {
    title: 'Plată și livrare',
    items: [
      {
        q: 'Cum pot plăti?',
        a: 'Cu cardul, online, prin Stripe (datele cardului nu ajung la noi), sau prin transfer bancar. La transfer, pregătim comanda după ce suma ajunge în cont.',
      },
      { q: 'Prețurile includ TVA?', a: `Da. Toate prețurile sunt în lei, cu ${terms.vat.replace(' inclus', '')} inclus.` },
      {
        q: 'Cât costă și cât durează livrarea?',
        a: `Livrarea este gratuită în România. Pregătim comanda în ${terms.processingDays} de la confirmarea plății, iar transportul durează de obicei ${terms.transitDays}.`,
      },
      { q: 'Pot comanda pe firmă?', a: 'Da. La finalizarea comenzii alegi „Persoană juridică” și completezi datele firmei. Factura se emite pe firmă.' },
    ],
  },
  {
    title: 'Retur și garanție',
    items: [
      {
        q: 'Pot returna produsul?',
        a: `Da. Ai ${terms.returnDays} zile de la primire să te retragi din contract, fără să spui motivul. Poți face asta online, din pagina „Retrage-te din contract”.`,
      },
      { q: 'Ce garanție am?', a: `Garanția legală de conformitate de ${terms.warrantyYears} ani. Detaliile sunt în pagina de garanție.` },
    ],
  },
  {
    title: 'Despre noi',
    items: [
      {
        q: 'Cine vinde produsele?',
        a: `${company.legalName}${company.cui ? `, CUI ${company.cui}` : ''}${company.address ? `, ${company.address}` : ''}. Biohack Tech este magazinul online.`,
      },
      { q: 'Cum vă contactez?', a: `Prin formularul de mai jos, la ${site.email} sau la ${site.phone}. Răspundem ${terms.responseTime}.` },
    ],
  },
]
