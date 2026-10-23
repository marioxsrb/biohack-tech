/**
 * The card testing attack of 20–23.10.2026 (BHT-20261020-0002, 20261021-0001/-0002/-0004, 20261022-0001,
 * 20261023-0002): the owner's decision of 23.10.2026.
 *   BLOCKED  no order is written: the email domain, the phone and the network (kept as the keyed hash of
 *            server/risk.ts ipKey, never the IP itself) of the attack.
 *   HOLD     the order is written but waits for a person ("Necesită verificare"), whatever the payment says:
 *            every phone and delivery address used in the attack.
 * Every temporary inbox below (owner's decision, 23.10.2026) is refused too: in the forms (checkout, popup, leads)
 * and on the server. A blocked network gets no answer from any form or API of the site (proxy.ts), in any browser.
 * Phones are their last 9 digits (risk.ts phoneKey); addresses are matched on the city and the start of the street
 * line, both without diacritics, punctuation or the words "str", "strada", "nr".
 */
export const BLOCKED = {
  emailDomains: ['mailnow.io'],
  emails: ['apopescu66@mailnow.io', 'marian.stanescu1@mailnow.io', 'mpop.65@mailnow.io'],
  phones: ['724541662', '373809013', '373808442', '373803641'],
  ipKeys: ['04c7541c20fc55cea8fa775a67b61a51'],
}

export const HOLD = {
  emailDomains: ['mailnow.io'],
  phones: ['724541662', '373809013', '373808442', '373803641'],
  addresses: [
    { city: 'clujnapoca', street: 'piataunirii2' },
    { city: 'bucuresti', street: 'rasaritului27' },
    { city: 'giroc', street: 'musetel97' },
  ],
}

/** Disposable inboxes (the address works for minutes or hours, then nobody reads it). */
export const DISPOSABLE = new Set([
  'mailnow.io', 'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamailblock.com', 'sharklasers.com', 'grr.la',
  '10minutemail.com', '10minutemail.net', 'temp-mail.org', 'temp-mail.io', 'tempmail.com', 'tempmail.net', 'tempmailo.com', 'tempail.com',
  'yopmail.com', 'yopmail.fr', 'yopmail.net', 'trashmail.com', 'trashmail.de', 'getnada.com', 'nada.email', 'maildrop.cc', 'dispostable.com',
  'throwawaymail.com', 'fakeinbox.com', 'mohmal.com', 'emailondeck.com', 'minuteinbox.com', 'mail.tm', 'mail.gw', 'tmail.ws', 'tmpmail.org',
  'tmpmail.net', 'mintemail.com', 'mytemp.email', 'spamgourmet.com', 'mailcatch.com', 'mailnesia.com', 'burnermail.io', 'inboxkitten.com',
  'emailfake.com', 'fakemail.net', 'luxusmail.org', 'dropmail.me', 'cmail.club', 'tempinbox.com', 'mailpoof.com', 'moakt.com', 'tempr.email',
  'discard.email', 'spambox.us', 'byom.de', 'trash-mail.com', 'wegwerfmail.de', 'einrot.com', 'mailforspam.com', 'tempmailaddress.com',
])

/** A temporary inbox (or a subdomain of one). */
export function isDisposable(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  return DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith(`.${d}`))
}
