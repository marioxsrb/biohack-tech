/**
 * The seller's legal identification (Legea 365/2002 art. 5, OUG 34/2014 art. 6). Public data, confirmed
 * by the company on 29.09.2026; the environment can override each field. The return address was not
 * given: it stays unset (not shown) until the company confirms it. See docs/OPEN-POINTS.md.
 * The bank account (IBAN) is not here: it lives only in the environment (BANK_*), shown to customers
 * on their own transfer order.
 */
const v = (k: string, confirmed?: string) => process.env[k]?.trim() || confirmed

export const company = {
  legalName: v('COMPANY_LEGAL_NAME', 'NEUROS EUROPE S.R.L.'),
  cui: v('COMPANY_CUI', '50323873'),
  regCom: v('COMPANY_REG_COM', 'J2024001256321'),
  address: v('COMPANY_ADDRESS', 'Str. N. D. Cocea, nr. 10, Sibiu, jud. Sibiu, România'),
  /** Where returned products go, when it differs from the registered office. */
  returnAddress: v('COMPANY_RETURN_ADDRESS'),
}

export const missingCompanyFields = () =>
  (
    [
      ['COMPANY_LEGAL_NAME', company.legalName],
      ['COMPANY_CUI', company.cui],
      ['COMPANY_REG_COM', company.regCom],
      ['COMPANY_ADDRESS', company.address],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([k]) => k)

/** One line for the footer and documents: only the fields that exist. */
export const companyLine = () =>
  [company.legalName, company.cui && `CUI ${company.cui}`, company.regCom && `Reg. Com. ${company.regCom}`, company.address].filter(Boolean).join(' · ')

/** Who the customer is dealing with, for sentences: the legal name when known, the brand otherwise. */
export const sellerName = () => company.legalName ?? 'Biohack Tech'

export type SellerIdentity = { legalName: string; cui: string; regCom: string; address: string }

/**
 * Who the seller was, by date: an order keeps the identity of the day it was placed, so a later change of operator
 * never rewrites old orders, documents or invoices (FGO issues under its own account; Stripe collects under its own).
 * NEUROS EUROPE S.R.L. since the store opened (identification confirmed 29.09.2026). A future change: add the new
 * identity with its effective date (`from`, ISO) at the end; orders placed from that date carry it.
 */
export const SELLER_HISTORY: { from: string; identity: SellerIdentity }[] = [
  { from: '2026-09-01T00:00:00+03:00', identity: { legalName: 'NEUROS EUROPE S.R.L.', cui: '50323873', regCom: 'J2024001256321', address: 'Str. N. D. Cocea, nr. 10, Sibiu, jud. Sibiu, România' } },
]

/** The seller in force at a moment (the environment's overrides apply to the current one only). */
export function sellerAt(at: Date): SellerIdentity {
  const current = SELLER_HISTORY.filter((h) => new Date(h.from) <= at).at(-1) ?? SELLER_HISTORY[0]
  if (current !== SELLER_HISTORY.at(-1)) return current.identity
  // Only what the environment sets explicitly overrides the identity in force (never a default).
  const env = (k: string) => process.env[k]?.trim() || undefined
  const i = current.identity
  return { legalName: env('COMPANY_LEGAL_NAME') ?? i.legalName, cui: env('COMPANY_CUI') ?? i.cui, regCom: env('COMPANY_REG_COM') ?? i.regCom, address: env('COMPANY_ADDRESS') ?? i.address }
}

/** The seller of an order: the identity stored on it when it was placed, or the one in force on its date. */
export const sellerOf = (o: { seller?: SellerIdentity | null; createdAt: Date }) => o.seller ?? sellerAt(o.createdAt)

export const sellerLine = (s: SellerIdentity) => [s.legalName, s.cui && `CUI ${s.cui}`, s.regCom && `Reg. Com. ${s.regCom}`, s.address].filter(Boolean).join(' · ')
