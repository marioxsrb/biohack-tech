export const site = {
  name: 'Biohack Tech',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://biohack-tech.ro').replace(/\/$/, ''),
  description:
    'Dispozitive de wellness pentru minte și corp, de folosit acasă: NEUROS Calm, Focus, Amber și casca Brain Flow. Livrare gratuită în România.',
  tagline: 'Tehnologie din neuroștiință, pentru bunăstarea de zi cu zi.',
  email: 'contact@neuros.ro',
  phone: '+40 757 890 707',
  phoneHref: 'tel:+40757890707',
  locale: 'ro_RO',
} as const

/** Commercial terms stated on the current biohack-tech.ro. Used everywhere they are repeated. */
export const terms = {
  vat: 'TVA 21% inclus',
  shipping: 'Livrare gratuită în România',
  processingDays: '1-3 zile',
  transitDays: '2-5 zile',
  returnDays: 14,
  warrantyYears: 2,
  responseTime: 'în cel mult 24 de ore',
} as const
