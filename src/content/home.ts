/**
 * Homepage copy beyond the hero and the product shelf: why Biohack Tech, the daily-rhythm comparison,
 * the FAQ (short on the homepage, complete on /intrebari-frecvente). Only facts that are already on the
 * product pages, the legal pages or config/site.ts. The source material's six testimonials were
 * unverifiable (docs/CONTENT-DECISIONS.md) and are not used; real reviews live in content/reviews.ts.
 */
import type { ProductImage } from './catalog'
import { company } from '@/config/company'
import { site, terms } from '@/config/site'
import type { Locale } from '@/i18n/locales'

import glSeara from '@/assets/img/glasses/result-seara.webp'

const photo = (src: ProductImage['src'], alt: string): ProductImage => ({ src, alt, kind: 'photo' })

/** Why Biohack Tech: one photograph and three reasons, each a verified fact. */
const whyRo = {
  title: 'De ce să alegi Biohack Tech',
  image: photo(glSeara, 'Femeie în pat, seara, citind pe tabletă cu ochelarii NEUROS Amber'),
  points: [
    { title: 'Câteva minute, o stare mai bună', text: 'Calm te ajută să te liniștești seara. Focus te ajută să fii mai prezent ziua. Amber face serile la ecran mai blânde.' },
    { title: 'Îți răspundem cu drag', text: 'Ne scrii sau ne suni. Te ajutăm să alegi ce ți se potrivește, și rămânem aproape după comandă.' },
    { title: 'Livrare gratuită și retur în 14 zile', text: `Livrarea este gratuită în România. Ai ${terms.returnDays} zile să te răzgândești. Primești garanție ${terms.warrantyYears} ani.` },
  ],
}

/**
 * "Aceeași zi. Alt ritm.": the same three moments of a day, without and with a deliberate tool. Contexts
 * and uses only (what the product is and how it is used), never an outcome.
 */
const rhythmRo = {
  title: 'Cum se simte ziua',
  intro: 'Aceeași zi, cu mai puțin stres, somn mai lin și mai mult focus.',
  without: 'Înainte',
  with: 'Cu NEUROS',
  rows: [
    { moment: 'Liniște', without: 'Stresul se adună toată ziua și îl iei cu tine acasă.', with: 'Cu NEUROS Calm, seara ai un moment doar al tău. Mulți utilizatori simt mai mult calm și un somn mai lin.' },
    { moment: 'Focus', without: 'Te apuci de o sarcină și atenția fuge la telefon.', with: 'NEUROS Focus te ajută să-ți aduni atenția. Mulți utilizatori simt mai mult focus și mai multă energie.' },
    { moment: 'Seri', without: 'Seara, ochii obosesc în lumina ecranelor.', with: 'Cu NEUROS Amber, lumina ecranelor se simte mai blândă. Serile devin mai liniștite.' },
  ],
  note: 'Fiecare om răspunde în ritmul lui. Sunt produse de wellness. Pentru o afecțiune, cere întâi sfatul medicului.',
}

export type FaqItem = { q: string; a: string }

/** The homepage keeps only the questions that decide a purchase. All of them are on /intrebari-frecvente. */
const homeFaqRo: FaqItem[] = [
  {
    q: 'Cum aleg produsul potrivit?',
    a: 'Vrei mai mult calm și un somn mai lin: NEUROS Calm. Vrei focus și claritate: NEUROS Focus. Vrei seri mai blânde la ecran: NEUROS Amber. Scrie-ne și te ajutăm să alegi.',
  },
  {
    q: 'Cum se folosesc?',
    a: 'NEUROS Calm îl pornești seara, pentru câteva minute de liniște. NEUROS Focus se leagă de o tabletă, iar jocurile te ajută să-ți antrenezi atenția. NEUROS Amber se poartă ca orice ochelari, ziua la birou și seara pe telefon.',
  },
  {
    q: 'Cum funcționează ofertele?',
    a: 'Iei 2 bucăți din același produs (NEUROS Calm sau Focus) și primești 10% reducere la ele. Iei 3 sau mai multe și primești 20%. Reducerea se calculează separat pentru fiecare produs. La NEUROS Amber, la fiecare 3 perechi, una este gratuită. Reducerile se aplică singure în coș și se cumulează.',
  },
  {
    q: 'Cum plătesc?',
    a: 'Ramburs, la livrare: plătești curierului când primești coletul. Sau cu cardul, online, prin Stripe, ori prin transfer bancar. Datele cardului rămân la Stripe. La transfer, pregătim comanda când suma ajunge în cont.',
  },
  {
    q: 'Cât durează livrarea și cum returnez?',
    a: `Livrarea este gratuită în România. Pregătim comanda în ${terms.processingDays} de la confirmarea plății, iar transportul durează de obicei ${terms.transitDays}. După ce primești produsul, ai ${terms.returnDays} zile să te răzgândești.`,
  },
  {
    q: 'Ce fel de produse sunt?',
    a: 'Sunt produse de wellness, pentru starea ta de zi cu zi. Te ajută să te simți mai calm și mai prezent. Dacă ai o afecțiune sau urmezi un tratament, vorbește întâi cu medicul tău.',
  },
]
export type FaqGroup = { title: string; items: FaqItem[] }

const faqRo: FaqGroup[] = [
  {
    title: 'Produse',
    items: [
      {
        q: 'Care produs mi se potrivește?',
        a: 'Pentru mai mult calm și un somn mai lin, NEUROS Calm, câteva minute seara. Pentru focus și claritate, NEUROS Focus, prin jocuri scurte. Pentru seri mai blânde la ecran, NEUROS Amber. Scrie-ne mai jos și te ajutăm să alegi.',
      },
      {
        q: 'Ce fel de produse sunt?',
        a: 'Sunt produse de wellness, pentru starea ta de zi cu zi. Te ajută să te simți mai calm și mai prezent. Dacă ai o afecțiune sau urmezi un tratament, vorbește întâi cu medicul tău.',
      },
      {
        q: 'Cum încep?',
        a: 'Fiecare produs intră ușor în zi: câteva minute de liniște, un joc scurt sau ochelarii pe care îi porți. Pentru orice întrebare, ne scrii sau ne suni.',
      },
    ],
  },
  {
    title: 'Oferte',
    items: [
      {
        q: 'Cum funcționează reducerile de 10% și 20%?',
        a: 'Iei 2 bucăți din același produs și primești 10% reducere la ele. Iei 3 sau mai multe și primești 20%. Merge la NEUROS Calm și NEUROS Focus, separat pentru fiecare produs: un Calm și un Focus nu primesc reducere. Restul comenzii rămâne la prețul întreg. Reducerea apare automat în coș.',
      },
      {
        q: 'Cum funcționează 2+1 gratis la NEUROS Amber?',
        a: 'La fiecare 3 perechi NEUROS Amber din aceeași comandă, una este gratuită. Poți combina ramele. Se aplică automat în coș și se poate cumula cu reducerea de 10% sau 20% la celelalte produse.',
      },
    ],
  },
  {
    title: 'Plată și livrare',
    items: [
      {
        q: 'Cum pot plăti?',
        a: 'Ramburs, la livrare: plătești curierului când primești coletul. Sau cu cardul, online, prin Stripe, ori prin transfer bancar. Datele cardului rămân la Stripe. La transfer, pregătim comanda când suma ajunge în cont.',
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
        a: `Da. Ai ${terms.returnDays} zile de la primire să te retragi din contract, din orice motiv. Poți face asta online, din pagina „Retrage-te din contract”.`,
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

const whyEn: typeof whyRo = {
  title: 'Why choose Biohack Tech',
  image: photo(glSeara, 'Woman in bed in the evening, reading on a tablet with NEUROS Amber glasses'),
  points: [
    { title: 'A few minutes, a better state', text: 'Calm helps you unwind in the evening. Focus helps you stay present through the day. Amber makes evenings at the screen feel softer.' },
    { title: 'We answer with care', text: 'Write or call us. We help you choose what suits you, and we stay close after you order.' },
    { title: `Free delivery and ${terms.returnDays}-day returns`, text: `Delivery is free, worldwide. You have ${terms.returnDays} days to change your mind. You get a ${terms.warrantyYears}-year warranty.` },
  ],
}

const rhythmEn: typeof rhythmRo = {
  title: 'How the day feels',
  intro: 'The same day, with less stress, easier sleep and more focus.',
  without: 'Before',
  with: 'With NEUROS',
  rows: [
    { moment: 'Calm', without: 'Stress builds up all day and follows you home.', with: 'With NEUROS Calm, the evening is a moment of your own. Many people feel calmer, and sleep comes more easily.' },
    { moment: 'Focus', without: 'You start a task and your attention drifts to your phone.', with: 'NEUROS Focus helps you gather your attention. Many people feel more focus and more energy.' },
    { moment: 'Evenings', without: 'In the evening, your eyes tire in the light of screens.', with: 'With NEUROS Amber, screen light feels softer. Evenings become calmer.' },
  ],
  note: 'Everyone responds at their own pace. These are wellness products. If you have a medical condition, ask your doctor first.',
}

const homeFaqEn: FaqItem[] = [
  {
    q: 'How do I choose the right product?',
    a: 'You want more calm and easier sleep: NEUROS Calm. You want focus and clarity: NEUROS Focus. You want softer evenings at the screen: NEUROS Amber. Write to us and we will help you choose.',
  },
  {
    q: 'How do I use them?',
    a: 'You switch NEUROS Calm on in the evening, for a few quiet minutes. NEUROS Focus connects to a tablet, and the games help you train your attention. You wear NEUROS Amber like any other glasses, at your desk by day and on your phone in the evening.',
  },
  {
    q: 'How do the offers work?',
    a: 'With 2 units of the same product (NEUROS Calm or Focus), you get 10% off them. With 3 or more, you get 20%. The discount is counted separately for each product. With NEUROS Amber, one pair in every 3 is free. The discounts apply automatically in the cart and add up.',
  },
  {
    q: 'How do I pay?',
    a: 'Cash on delivery: you pay the courier when the parcel arrives. Or by card, online, through Stripe, or by bank transfer. Your card details stay with Stripe. With a bank transfer, we prepare your order once the payment reaches our account.',
  },
  {
    q: 'How long does delivery take, and how do I return a product?',
    a: `Delivery is free, worldwide. We prepare your order within ${terms.processingDays.replace(' zile', ' days')} of payment, and shipping within Romania usually takes ${terms.transitDays.replace(' zile', ' days')}. Once you receive the product, you have ${terms.returnDays} days to change your mind.`,
  },
  {
    q: 'What kind of products are these?',
    a: 'They are wellness products for how you feel day to day. They help you feel calmer and more present. If you have a medical condition or follow a treatment, talk to your doctor first.',
  },
]

/** A homepage question reused on the FAQ page, found by its text (an index would shift when one is removed). */
function faqItem(list: FaqItem[], q: string): FaqItem {
  const item = list.find((f) => f.q === q)
  if (!item) throw new Error(`FAQ question not found: ${q}`)
  return item
}

const faqEn: FaqGroup[] = [
  {
    title: 'Products',
    items: [
      {
        q: 'Which product suits me?',
        a: 'For more calm and easier sleep, NEUROS Calm, a few minutes in the evening. For focus and clarity, NEUROS Focus, through short games. For softer evenings at the screen, NEUROS Amber. Write to us below and we will help you choose.',
      },
      faqItem(homeFaqEn, 'What kind of products are these?'),
      {
        q: 'How do I start?',
        a: 'Each product fits easily into the day: a few quiet minutes, a short game, or glasses you wear. For any question, write or call us.',
      },
    ],
  },
  {
    title: 'Offers',
    items: [
      {
        q: 'How do the 10% and 20% discounts work?',
        a: 'With 2 units of the same product, you get 10% off them. With 3 or more, you get 20%. It applies to NEUROS Calm and NEUROS Focus, separately for each product: one Calm and one Focus get no discount. The rest of the order stays at full price. The discount shows automatically in the cart.',
      },
      {
        q: 'How does 3 for 2 work on NEUROS Amber?',
        a: 'In every 3 pairs of NEUROS Amber in the same order, one is free. You can mix the frames. It applies automatically in the cart and adds up with the 20% discount on the other products.',
      },
    ],
  },
  {
    title: 'Payment and delivery',
    items: [
      { q: 'How can I pay?', a: faqItem(homeFaqEn, 'How do I pay?').a },
      { q: 'Do prices include VAT?', a: `Yes. All prices are in lei, with ${terms.vat.replace('TVA ', '').replace(' inclus', '')} VAT included.` },
      {
        q: 'How much does delivery cost, and how long does it take?',
        a: `Delivery is free, worldwide. We prepare your order within ${terms.processingDays.replace(' zile', ' days')} of payment, and shipping within Romania usually takes ${terms.transitDays.replace(' zile', ' days')}.`,
      },
      { q: 'Can I order as a company?', a: 'Yes. At checkout, choose “Company” and fill in the company details. The invoice is issued to the company.' },
    ],
  },
  {
    title: 'Returns and warranty',
    items: [
      {
        q: 'Can I return a product?',
        a: `Yes. You have ${terms.returnDays} days from delivery to withdraw from the contract, for any reason. You can do it online, on the withdrawal page.`,
      },
      { q: 'What warranty do I get?', a: `The ${terms.warrantyYears}-year legal guarantee of conformity. The details are on the warranty page.` },
    ],
  },
  {
    title: 'About us',
    items: [
      {
        q: 'Who sells the products?',
        a: `${company.legalName}${company.cui ? `, VAT number ${company.cui}` : ''}${company.address ? `, ${company.address}` : ''}. Biohack Tech is the online shop.`,
      },
      { q: 'How do I contact you?', a: `Through the form below, at ${site.email} or at ${site.phone}. We reply within 24 hours.` },
    ],
  },
]

type HomeContent = { why: typeof whyRo; rhythm: typeof rhythmRo; homeFaq: FaqItem[]; faq: FaqGroup[] }

/** Homepage and FAQ text in each language. */
export const homeContent: Record<Locale, HomeContent> = {
  ro: { why: whyRo, rhythm: rhythmRo, homeFaq: homeFaqRo, faq: faqRo },
  en: { why: whyEn, rhythm: rhythmEn, homeFaq: homeFaqEn, faq: faqEn },
}
