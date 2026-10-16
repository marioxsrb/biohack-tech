/**
 * Diana L. Palotaș's book, „Știu. Vreau. DE CE NU POT?”: the editorial page's words. Nothing here is invented:
 *   - title, subtitle, author, place and year: the book's title page (Sibiu, 2026);
 *   - the short description and the English title: NEUROS (neuros.ro/cartea-dianei);
 *   - the author's bio: NEUROS's page about her (neuros.ro/diana-palotas);
 *   - the chapters and the quotes: the book's own contents and preface.
 * The book is written in Romanian (print and PDF); the English page says so and translates only chapter titles.
 * Price and delivery fee: config/prices.ts. How the PDF reaches the customer: server/digital.
 */
import type { Locale } from '@/i18n/locales'

export type BookCopy = {
  seo: { title: string; description: string }
  /** Under the price, on the product page's buy column. */
  intro: string
  /** Four facts above the price. */
  highlights: string[]
  /** The English title NEUROS uses (shown as a translation on the English page). */
  titleEn: string
  about: { eyebrow: string; title: string; paragraphs: string[] }
  /** The preface, in the author's own words. */
  quotes: string[]
  contents: { eyebrow: string; title: string; intro: string; chapters: { n: string; title: string; topics?: string[] }[]; extra: string }
  author: { eyebrow: string; name: string; role: string; bio: string; alt: string }
  /** `fee`: the line next to the delivery amount (the amount itself is rendered as a price, hidden behind the gate). */
  delivery: { eyebrow: string; title: string; steps: { title: string; text: string }[]; note: string; fee: string }
  specs: { label: string; value: string }[]
  faqs: { q: string; a: string }[]
  closing: { title: string; text: string }
}

const ro: BookCopy = {
  seo: {
    title: 'Știu. Vreau. DE CE NU POT? Cartea Dianei L. Palotaș, fizică + PDF',
    description:
      'Cartea „Știu. Vreau. DE CE NU POT? Răspunsul este în creier” de Diana L. Palotaș: ediția fizică livrată acasă și versiunea PDF, disponibilă după confirmarea plății.',
  },
  intro: 'Primești cartea fizică prin curier și versiunea PDF. Cu cardul, PDF-ul este gata imediat după confirmarea plății.',
  highlights: [
    'Ediția fizică + versiunea PDF',
    'Scrisă de Diana L. Palotaș, psiholog și terapeut',
    'Povești de viață, obiceiuri simple și un ghid EEG pe înțelesul tuturor',
    'Livrarea se plătește o singură dată pe comandă',
  ],
  titleEn: "I Know. I Want. WHY CAN'T I?",
  about: {
    eyebrow: 'Despre carte',
    title: 'Știi ce ai de făcut. Îți dorești schimbarea. Și totuși ceva te oprește.',
    paragraphs: [
      'Cartea Dianei L. Palotaș pornește de la această întrebare și caută răspunsul acolo unde începe totul: în creier.',
      'Nu este o listă de reguli. Sunt povești de viață, obiceiuri simple și explicații clare despre cum funcționează creierul, scrise de un psiholog cu peste 20 de ani de experiență.',
    ],
  },
  quotes: [
    'Cartea aceasta e despre tine.',
    'Nu sunt alte reguli menite să îți fure plăcerea vieții. Sunt povești de viață. Sunt obiceiuri simple. Sunt lucruri care îți pot atinge butonul schimbării.',
    'Timpul tău e prețios. Atenția e moneda cea mai valoroasă. Îți promit că nu vei cheltui energie inutil.',
    'Plecăm de la un ghid Basic și personalizăm. Măsurăm. Ajustăm. Monitorizăm.',
  ],
  contents: {
    eyebrow: 'Cuprins',
    title: 'Ce găsești în carte',
    intro: 'Zece capitole, de la întrebarea „Ești bine?” până la un ghid despre EEG și QEEG.',
    chapters: [
      { n: 'I', title: 'Ești bine?', topics: ['Cum resetezi pilotul automat?', 'Fotobiomodularea', 'Nervul vag, legătura dintre creier și corp'] },
      { n: 'II', title: 'Povești', topics: ['Ce se află în spatele succesului', 'Alarma care nu se mai oprește', 'Cum depășești o traumă?'] },
      { n: 'III', title: 'Dreptatea în lume' },
      { n: 'IV', title: 'Pilotul automat' },
      { n: 'V', title: 'Autenticitate versus IA' },
      { n: 'VI', title: 'Ascultă-ți corpul', topics: ['Somnul', 'Lumina naturală', 'Apa și mâncarea', 'Respirația și mișcarea'] },
      { n: 'VII', title: 'Longevitatea' },
      { n: 'VIII', title: 'Crezi că IA-ul va lua locul oamenilor în psihologie?' },
      { n: 'IX', title: 'Cum să rămâi motivat' },
      { n: 'X', title: 'EEG și QEEG pe înțelesul tuturor', topics: ['Undele cerebrale, explicate simplu', 'Cum se citește un raport QEEG', 'Ce este tPBM'] },
    ],
    extra: 'La final: întrebări frecvente, ariile creierului, fișa creierului pentru neuromodulare și bibliografia.',
  },
  author: {
    eyebrow: 'Autoarea',
    name: 'Diana L. Palotaș',
    role: 'Fondatoare și CEO Neuros Europe',
    bio: 'Diana Palotaș este psiholog și terapeut cu peste 20 de ani de experiență, fondatoarea și CEO-ul Neuros Europe. A adus tehnologia iMediSync în Europa și formează specialiști în brain mapping din întreaga Europă.',
    alt: 'Diana L. Palotaș',
  },
  delivery: {
    eyebrow: 'Fizic + digital',
    title: 'Cum primești cartea',
    steps: [
      { title: 'Plătești cu cardul', text: 'Imediat ce Stripe confirmă plata, descarci PDF-ul din pagina comenzii. Îți trimitem linkul și pe email.' },
      { title: 'Plătești prin transfer bancar', text: 'Când primim banii, îți trimitem pe email linkul pentru PDF.' },
      { title: 'Plătești la livrare', text: 'După ce primești coletul, îți trimitem pe email linkul pentru PDF.' },
    ],
    note: 'Cartea fizică pleacă prin curier în 1–3 zile lucrătoare. Livrarea se plătește o singură dată pe comandă, oricâte cărți sau alte produse ai în coș.',
    fee: 'Livrare, o dată pe comandă (TVA inclus)',
  },
  specs: [
    { label: 'Titlu', value: 'Știu. Vreau. DE CE NU POT? Răspunsul este în creier' },
    { label: 'Autoare', value: 'Diana L. Palotaș' },
    { label: 'Apariție', value: 'Sibiu, 2026' },
    { label: 'Limba', value: 'Română' },
    { label: 'Ce primești', value: 'Cartea fizică și versiunea PDF' },
    { label: 'Livrare', value: 'O singură dată pe comandă' },
  ],
  faqs: [
    {
      q: 'Când primesc PDF-ul?',
      a: 'Cu cardul, imediat după ce plata este confirmată: butonul „Descarcă versiunea PDF” apare în pagina comenzii și primești linkul și pe email. Prin transfer bancar, după ce primim banii. La plata la livrare, după ce primești coletul.',
    },
    {
      q: 'Cât costă livrarea?',
      a: 'Livrarea se plătește o singură dată pe comandă și o vezi în coș înainte să plătești. Nu contează câte cărți comanzi sau ce alte produse mai ai în coș. Comenzile fără carte au livrare gratuită, ca până acum.',
    },
    {
      q: 'Se aplică un cod de reducere?',
      a: 'Da, codurile de reducere valabile se aplică și la carte. Reducerea nu se aplică la livrare. Cartea nu are reduceri automate la cantitate.',
    },
    {
      q: 'Linkul de descărcare nu mai funcționează. Ce fac?',
      a: 'Din motive de securitate, linkurile expiră. Deschide pagina comenzii pentru un link nou sau scrie-ne și îți trimitem altul.',
    },
    {
      q: 'Pot returna cartea?',
      a: 'Ai 14 zile de la primire să returnezi cartea fizică. Dacă o comandă este anulată sau rambursată, linkul pentru PDF nu mai funcționează.',
    },
  ],
  closing: {
    title: 'Răspunsul este în creier.',
    text: 'Cartea fizică ajunge la tine prin curier. Versiunea PDF o poți citi din prima zi.',
  },
}

const en: BookCopy = {
  seo: {
    title: "Știu. Vreau. DE CE NU POT? (I Know. I Want. WHY CAN'T I?) by Diana L. Palotaș",
    description:
      "Diana L. Palotaș's book “Știu. Vreau. DE CE NU POT? The answer is in the brain”, in Romanian: the print edition delivered to you and the PDF, available once your payment is confirmed.",
  },
  intro: 'You get the print book by courier and the PDF. Both are in Romanian. Paying by card, the PDF is ready as soon as the payment is confirmed.',
  highlights: [
    'Print edition + PDF, in Romanian',
    'Written by Diana L. Palotaș, psychologist and therapist',
    'Life stories, simple habits and a plain-words EEG guide',
    'One delivery fee per order',
  ],
  titleEn: "I Know. I Want. WHY CAN'T I?",
  about: {
    eyebrow: 'About the book',
    title: 'You know what to do. You want the change. Yet something holds you back.',
    paragraphs: [
      "Diana L. Palotaș's book starts from this question and looks for the answer where everything begins: in the brain.",
      'It is not a list of rules. It is life stories, simple habits and clear explanations of how the brain works, written by a psychologist with more than 20 years of experience. The book is written in Romanian.',
    ],
  },
  quotes: [
    'This book is about you.',
    'These are not more rules meant to steal the joy of life. They are life stories. They are simple habits. They are things that can touch your button for change.',
    'Your time is precious. Attention is the most valuable currency.',
  ],
  contents: {
    eyebrow: 'Contents',
    title: "What's inside",
    intro: 'Ten chapters, from the question “Are you well?” to a guide to EEG and QEEG. Chapter titles translated from Romanian.',
    chapters: [
      { n: 'I', title: 'Are you well?', topics: ['How to reset the autopilot', 'Photobiomodulation', 'The vagus nerve, the link between brain and body'] },
      { n: 'II', title: 'Stories', topics: ['What lies behind success', 'The alarm that never stops', 'How do you overcome a trauma?'] },
      { n: 'III', title: 'Justice in the world' },
      { n: 'IV', title: 'The autopilot' },
      { n: 'V', title: 'Authenticity versus AI' },
      { n: 'VI', title: 'Listen to your body', topics: ['Sleep', 'Natural light', 'Water and food', 'Breathing and movement'] },
      { n: 'VII', title: 'Longevity' },
      { n: 'VIII', title: 'Do you think AI will replace people in psychology?' },
      { n: 'IX', title: 'How to stay motivated' },
      { n: 'X', title: 'EEG and QEEG in plain words', topics: ['Brain waves, simply explained', 'How to read a QEEG report', 'What tPBM is'] },
    ],
    extra: 'At the end: frequently asked questions, the brain areas, a brain chart for neuromodulation and the bibliography.',
  },
  author: {
    eyebrow: 'The author',
    name: 'Diana L. Palotaș',
    role: 'Founder and CEO of Neuros Europe',
    bio: 'Diana Palotaș is a psychologist and therapist with more than 20 years of experience, the founder and CEO of Neuros Europe. She brought the iMediSync technology to Europe and trains brain mapping specialists from across Europe.',
    alt: 'Diana L. Palotaș',
  },
  delivery: {
    eyebrow: 'Print + digital',
    title: 'How you get the book',
    steps: [
      { title: 'You pay by card', text: 'As soon as Stripe confirms the payment, you download the PDF from your order page. We also email you the link.' },
      { title: 'The print book ships', text: 'The print edition leaves by courier within 1–3 business days.' },
      { title: 'One delivery fee', text: 'The delivery fee is charged once per order, however many books or other products are in your cart.' },
    ],
    note: 'Orders on this site are paid by card. The book and the PDF are in Romanian.',
    fee: 'Delivery, once per order (VAT included)',
  },
  specs: [
    { label: 'Title', value: 'Știu. Vreau. DE CE NU POT? Răspunsul este în creier' },
    { label: 'English title', value: "I Know. I Want. WHY CAN'T I? The answer is in the brain" },
    { label: 'Author', value: 'Diana L. Palotaș' },
    { label: 'Published', value: 'Sibiu, 2026' },
    { label: 'Language', value: 'Romanian' },
    { label: 'You get', value: 'The print book and the PDF' },
  ],
  faqs: [
    { q: 'When do I get the PDF?', a: 'As soon as your card payment is confirmed: the “Download the PDF” button appears on your order page and we email you the link.' },
    { q: 'Is the book in English?', a: 'No. The print edition and the PDF are in Romanian. Only the chapter titles on this page are translated.' },
    { q: 'How much is delivery?', a: 'One delivery fee per order, shown in your cart and at checkout. Orders without the book ship free, as before.' },
    { q: 'My download link stopped working. What do I do?', a: 'Links expire for security. Open your order page for a new one, or write to us and we will send you another.' },
    { q: 'Can I return the book?', a: 'You have 14 days from delivery to return the print book. If an order is cancelled or refunded, the PDF link stops working.' },
  ],
  closing: { title: 'The answer is in the brain.', text: 'The print book reaches you by courier. The PDF you can read from day one.' },
}

export const bookCopy = (locale: Locale = 'ro'): BookCopy => (locale === 'en' ? en : ro)
