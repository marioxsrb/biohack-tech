/**
 * Homepage copy beyond the hero and the product cards: the daily-rhythm comparison, four moments of a
 * day, the FAQ. Only facts that are already on the product pages, the legal pages or config/site.ts.
 * No testimonials: the source material's six were unverifiable (docs/CONTENT-DECISIONS.md), so the
 * moments below are described by us, as uses of the products, never as what a customer said.
 */
import type { ProductId, ProductImage } from './catalog'
import { company } from '@/config/company'
import { site, terms } from '@/config/site'

import bwCalm from '@/assets/img/balance-wave/result-calm.webp'
import bwCanapea from '@/assets/img/balance-wave/lifestyle-canapea.webp'
import glSeara from '@/assets/img/glasses/audience-seara.webp'
import glBirou from '@/assets/img/glasses/result-focus.webp'
import blLucru from '@/assets/img/brainlink/audience-lucru.webp'
import bfBarbat from '@/assets/img/brain-flow/lifestyle-barbat.webp'

const photo = (src: ProductImage['src'], alt: string): ProductImage => ({ src, alt, kind: 'photo' })

export const rhythm = {
  title: 'Aceeași zi. Alt ritm.',
  intro: 'Nu promitem o altă viață. Doar câteva minute, puse la locul lor în zi, cu un instrument făcut pentru ele.',
  before: {
    label: 'Fără un obicei',
    image: photo(glSeara, 'Laptop deschis pe noptieră, seara, lângă o veioză'),
    items: ['Seara trece direct de la ecran la somn.', 'Pauzele se umplu cu telefonul.', 'Relaxarea rămâne pentru „când o fi timp”.', 'Soluții luate la întâmplare, fără un plan.'],
  },
  after: {
    label: 'Cu un obicei BiohackTech',
    image: photo(bwCalm, 'Femeie relaxată acasă, cu ochii închiși, purtând NEUROS Calm la gât'),
    items: [
      'Câteva minute cu NEUROS Calm, seara, la aceeași oră.',
      'O sesiune scurtă cu NEUROS Focus, în locul unei pauze pe telefon.',
      'Ecranele de seară, prin lentilele NEUROS Amber.',
      'Un protocol stabilit cu specialistul, pentru Brain Flow.',
    ],
  },
  note: 'Fiecare om e diferit, la fel și efectele. Produsele sunt de wellness și nu înlocuiesc sfatul medicului.',
}

export type DayMoment = { time: string; title: string; text: string; productId: ProductId; image: ProductImage; position?: string }

export const day = {
  kicker: 'Experiențe BiohackTech',
  title: 'O zi, patru momente.',
  intro: 'Cum își face loc fiecare produs într-o zi obișnuită. Fără rețete: tu alegi ora și durata.',
  moments: [
    {
      time: 'Dimineața',
      title: 'La birou, înainte de muncă',
      text: 'O sesiune scurtă cu NEUROS Focus: jocuri pe tabletă care înaintează când ești atent. Progresul rămâne salvat.',
      productId: 'brainlink-pro',
      image: photo(blLucru, 'Bărbat la birou, purtând casca NEUROS Focus și scriind'),
      position: 'object-[60%_50%]',
    },
    {
      time: 'După-amiaza',
      title: 'În fața ecranului',
      text: 'Lentilele NEUROS Amber filtrează lumina albastră a monitorului. Rama e ușoară, pentru toată ziua.',
      productId: 'ochelari-biohack',
      image: photo(glBirou, 'Bărbat concentrat la birou, purtând ochelarii NEUROS Amber'),
      position: 'object-[55%_40%]',
    },
    {
      time: 'Seara',
      title: 'Pe canapea, câteva minute',
      text: 'NEUROS Calm la gât, între 5 și 20 de minute de lumină roșie. Se oprește singur.',
      productId: 'balance-wave',
      image: photo(bwCanapea, 'Femeie relaxată pe canapea, purtând NEUROS Calm'),
      position: 'object-[45%_50%]',
    },
    {
      time: 'Acasă, oricând',
      title: 'Ședința din protocolul tău',
      text: 'Brain Flow, cu zonele, durata și frecvența setate împreună cu specialistul la început.',
      productId: 'brain-flow',
      image: photo(bfBarbat, 'Bărbat relaxat pe canapea, cu casca Brain Flow pe cap'),
      position: 'object-[70%_40%]',
    },
  ] satisfies DayMoment[],
}

/**
 * Real customer words, when there are some. Add an entry only with the customer's written consent and a
 * source you can show (email, review platform). The homepage shows the block only when this is not empty.
 */
export type Testimonial = { quote: string; name: string; productId: ProductId; source: string; consentAt: string }
export const testimonials: Testimonial[] = []

export type FaqItem = { q: string; a: string }
export type FaqGroup = { title: string; items: FaqItem[] }

export const faq: FaqGroup[] = [
  {
    title: 'Produse',
    items: [
      {
        q: 'Care produs mi se potrivește?',
        a: 'NEUROS Calm, pentru câteva minute de relaxare, seara. NEUROS Focus, pentru antrenamentul atenției prin jocuri pe tabletă. NEUROS Amber, pentru orele în fața ecranelor. Brain Flow, pentru un protocol de fotobiomodulare acasă, stabilit cu un specialist. Dacă nu ești sigur, scrie-ne mai jos și te ajutăm să alegi.',
      },
      {
        q: 'Sunt dispozitive medicale?',
        a: 'Sunt produse de wellness, pentru uz zilnic. Nu înlocuiesc sfatul medicului. Dacă ai o afecțiune sau urmezi un tratament, vorbește întâi cu medicul tău.',
      },
      {
        q: 'Mă ajută cineva să încep?',
        a: 'Da. Pentru NEUROS Calm, NEUROS Focus și Brain Flow, un specialist Biohack Tech îți recomandă programul potrivit. La Brain Flow, protocolul se stabilește la consultația de început.',
      },
      {
        q: 'Ce diferă între configurațiile Brain Flow?',
        a: 'Casca și tehnologia sunt aceleași. Diferă câte zone poți activa în același protocol: 1, 4 sau 13. Fiecare configurație are prețul ei, afișat pe pagina produsului.',
      },
    ],
  },
  {
    title: 'Oferte',
    items: [
      {
        q: 'Cum funcționează reducerea de 20%?',
        a: 'Când ai în coș cel puțin 3 produse NEUROS Calm, NEUROS Focus sau Brain Flow, în orice combinație (și de același fel), primești 20% reducere la ele. NEUROS Amber nu intră în calcul. Reducerea apare automat în coș.',
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
