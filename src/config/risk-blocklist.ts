/**
 * The card testing attack of 20–23.10.2026 (BHT-20261020-0002, 20261021-0001/-0002/-0004, 20261022-0001,
 * 20261023-0002): the owner's decision of 23.10.2026.
 *   BLOCKED  no order is written: the email domain, the phone and the network (kept as the keyed hash of
 *            server/risk.ts ipKey, never the IP itself) of the attack.
 *   HOLD     the order is written but waits for a person ("Necesită verificare"), whatever the payment says:
 *            every phone and delivery address used in the attack.
 * Phones are their last 9 digits (risk.ts phoneKey); addresses are matched on the city and the start of the street
 * line, both without diacritics, punctuation or the words "str", "strada", "nr".
 */
export const BLOCKED = {
  emailDomains: ['mailnow.io'],
  phones: ['724541662'],
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
