/**
 * The seller's legal identification (Legea 365/2002 art. 5, OUG 34/2014 art. 6), from the environment
 * at build time. Public data, but only the company can confirm it, so nothing is filled in here.
 * A missing field is simply not shown (no placeholder text on the site); in production the readiness
 * report in /admin lists it as an error until it is set. See docs/OPEN-POINTS.md.
 */
const v = (k: string) => process.env[k]?.trim() || undefined

export const company = {
  legalName: v('COMPANY_LEGAL_NAME'),
  cui: v('COMPANY_CUI'),
  regCom: v('COMPANY_REG_COM'),
  address: v('COMPANY_ADDRESS'),
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
