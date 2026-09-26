/**
 * Bank transfer details. They come only from the environment: nothing here is a default,
 * so a missing value can never be shown to a customer as if it were real.
 * Bank transfer is offered only when all required values are set AND orders have somewhere
 * to go (ORDER_WEBHOOK_URL), because a transfer order must reach a person to be fulfilled.
 */
import 'server-only'

export type BankDetails = {
  beneficiary: string
  bank: string
  iban: string
  swift?: string
}

/** ISO 13616 mod-97 check, so a mistyped IBAN in the environment is caught before a customer sees it. */
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false
  if (iban.startsWith('RO') && iban.length !== 24) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let rem = 0
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97
  return rem === 1
}

export function getBankDetails(): BankDetails | null {
  const iban = process.env.BANK_IBAN?.trim()
  const bank = process.env.BANK_NAME?.trim()
  const beneficiary = process.env.BANK_BENEFICIARY?.trim()
  if (!iban || !bank || !beneficiary) return null
  if (!isValidIban(iban)) {
    console.error('[bank] BANK_IBAN is set but is not a valid IBAN; bank transfer stays off.')
    return null
  }
  const swift = process.env.BANK_SWIFT?.trim() || undefined
  return { iban: iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim(), bank, beneficiary, swift }
}

export function getOrderWebhook(): { url: string; secret?: string } | null {
  const url = process.env.ORDER_WEBHOOK_URL?.trim()
  if (!url || !/^https?:\/\//.test(url)) return null
  return { url, secret: process.env.ORDER_WEBHOOK_SECRET?.trim() || undefined }
}
