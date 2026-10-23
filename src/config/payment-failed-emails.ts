/**
 * The failed card payment flow (workflow "payment-failed"): two emails, drafted 23.10.2026, NOT approved. Until the
 * owner approves them (and sending through the sub-account is approved), the engine keeps every such enrollment
 * paused with stop_reason 'copy_pending' (server/workflows/engine.ts) and nothing is sent.
 *
 * Kept apart from Abandoned Cart: the customer wanted to pay, the bank refused. Same rules as the other reminders:
 * marketing consent, stops at the purchase or the unsubscribe, counts towards the weekly limit. The variables are
 * those of server/workflows/ghl-map.ts (contact fields that already exist in the sub-account).
 */
export type DraftEmail = { template: string; afterHours: number; subject: string; preheader: string; title: string; body: string; ctaText: string; ctaUrl: string }

export const PAYMENT_FAILED_STATUS = 'draft' as const

export const PAYMENT_FAILED_EMAILS: DraftEmail[] = [
  {
    template: 'payment-failed-01',
    afterHours: 1,
    subject: 'Comanda ta te așteaptă. Mai încearcă o dată plata',
    preheader: 'Durează un minut. Produsele sunt în coș.',
    title: 'Mai încearcă o dată plata',
    body: [
      'Bună, {{contact.first_name}}!',
      'Banca a refuzat plata cu cardul pentru comanda ta. Se întâmplă des și se rezolvă repede.',
      'Ce poți face:',
      '- Încearcă din nou cu același card. Uneori banca cere o confirmare în aplicație.',
      '- Plătește cu alt card.',
      '- Alege plata ramburs, la livrare.',
      'În coș ai: {{cart_items}}.',
    ].join('\n\n'),
    ctaText: 'Reia comanda',
    ctaUrl: '{{checkout_url}}',
  },
  {
    template: 'payment-failed-02',
    afterHours: 24,
    subject: 'Te ajutăm cu plata?',
    preheader: 'Card, transfer bancar sau ramburs. Alegi tu.',
    title: 'Alege cum plătești',
    body: [
      'Bună, {{contact.first_name}}!',
      'Comanda ta te așteaptă. Poți plăti cu cardul, prin transfer bancar sau ramburs, la livrare.',
      'Ai nevoie de ajutor? Răspunde la acest email sau sună-ne la +40 767 978 707. Îți răspundem în cel mult 24 de ore.',
    ].join('\n\n'),
    ctaText: 'Finalizează comanda',
    ctaUrl: '{{checkout_url}}',
  },
]
