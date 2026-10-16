/** Shared by the digital delivery pages. */
export const dt = (d: Date | null) => (d ? d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

export const EMAIL_LABEL = { none: 'Netrimis', queued: 'În coadă', sent: 'Trimis', failed: 'Eșuat' } as const

/** The audit's event types, in the team's words. */
export const EVENT_LABEL: Record<string, string> = {
  granted: 'Acces acordat',
  revoked: 'Acces revocat',
  restored: 'Acces redat',
  'email.sent': 'Email trimis',
  'email.failed': 'Email eșuat',
  'email.blocked': 'Email oprit (comanda nu mai are dreptul)',
  'email.manual_requested': 'Trimitere cerută manual',
  'email.manual_refused': 'Trimitere refuzată (blocată)',
  'link.copied': 'Link copiat din admin',
  'download.ok': 'Descărcare',
  'download.denied': 'Descărcare refuzată',
  'download.failed': 'Descărcare eșuată (sursa NEUROS)',
}
