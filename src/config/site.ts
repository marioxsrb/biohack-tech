export const site = {
  name: 'Biohack Tech',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://biohack-tech.ro').replace(/\/$/, ''),
  description: {
    ro: 'Dispozitive NEUROS pentru stres, concentrare și ochi obosiți de ecrane: Calm, Focus, Amber și Flow. Le folosești acasă. Livrare gratuită în România.',
    en: 'NEUROS devices for stress, focus and screen-tired eyes: Calm, Focus, Amber and Flow. Use them at home. Free delivery in Romania.',
  },
  email: 'contact@biohack-tech.ro',
  phone: '+40 757 890 707',
  phoneHref: 'tel:+40757890707',
  /**
   * The official WhatsApp number for orders (+40 765 874 571, confirmed 08.10.2026), digits only in
   * international format, as wa.me expects. null hides the WhatsApp button.
   */
  whatsapp: '40765874571' as string | null,
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
