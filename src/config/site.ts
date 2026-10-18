export const site = {
  name: 'Biohack Tech',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://biohack-tech.ro').replace(/\/$/, ''),
  description: {
    ro: 'NEUROS te ajută să te liniștești seara, să treci mai ușor spre somn și să ai mai mult focus ziua. Calm, Focus și Amber. Livrare gratuită în România.',
    en: 'NEUROS helps you unwind in the evening, ease into sleep and stay focused through the day. Calm, Focus and Amber. Free worldwide delivery.',
  },
  email: 'contact@biohack-tech.ro',
  phone: '+40 757 890 707',
  phoneHref: 'tel:+40757890707',
  /**
   * The official WhatsApp number for orders (+40 757 890 707, the same as the phone; confirmed 14.10.2026), digits only in
   * international format, as wa.me expects. null hides the WhatsApp button.
   */
  whatsapp: '40757890707' as string | null,
  /**
   * Where bank-transfer customers send the proof of payment (+40 765 874 571), so the order is approved and packed
   * without waiting for the bank statement. Digits only, as wa.me expects; null hides the button.
   */
  paymentProofWhatsapp: '40765874571' as string | null,
} as const

/**
 * WhatsApp with the proof-of-payment message already written (order number and amount): the customer only attaches
 * the screenshot or PDF from the bank. Null when no number is configured.
 */
export function paymentProofHref(orderNumber: string, amount: string, locale: 'ro' | 'en' = 'ro'): string | null {
  if (!site.paymentProofWhatsapp) return null
  const text =
    locale === 'en'
      ? `Hello! I paid order ${orderNumber} (${amount}) by bank transfer. Here is the proof of payment:`
      : `Bună! Am plătit comanda ${orderNumber} (${amount}) prin transfer bancar. Atașez dovada plății:`
  return `https://wa.me/${site.paymentProofWhatsapp}?text=${encodeURIComponent(text)}`
}

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
