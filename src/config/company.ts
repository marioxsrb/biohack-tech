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
