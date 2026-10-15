/**
 * Countries the store delivers to (all of them, delivery free). ISO 3166-1 alpha-2 codes; names come from the
 * browser's or server's Intl data in the visitor's language, so no translation table is kept here.
 */
import type { Locale } from '@/i18n/locales'

// prettier-ignore
export const COUNTRY_CODES = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AR','AT','AU','AW','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BM','BN','BO','BR','BS','BT','BW','BY','BZ',
  'CA','CD','CF','CG','CH','CI','CL','CM','CN','CO','CR','CU','CV','CW','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','ER','ES','ET','FI','FJ','FO','FR',
  'GA','GB','GD','GE','GG','GH','GI','GL','GM','GN','GQ','GR','GT','GU','GW','GY','HK','HN','HR','HT','HU','ID','IE','IL','IM','IN','IQ','IS','IT','JE','JM','JO','JP',
  'KE','KG','KH','KM','KN','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MG','MK','ML','MM','MN','MO','MR','MT','MU','MV','MW','MX','MY','MZ',
  'NA','NC','NE','NG','NI','NL','NO','NP','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PR','PS','PT','PY','QA','RE','RO','RS','RW','SA','SB','SC','SD','SE','SG','SI','SK','SL','SM','SN','SO','SR','SS','SV','SY','SZ',
  'TC','TD','TG','TH','TJ','TL','TM','TN','TO','TR','TT','TW','TZ','UA','UG','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WS','XK','YE','ZA','ZM','ZW',
] as const

export const isCountry = (c: unknown): c is string => typeof c === 'string' && (COUNTRY_CODES as readonly string[]).includes(c)

const names = new Map<Locale, Intl.DisplayNames>()
export function countryName(code: string, locale: Locale = 'ro'): string {
  if (code === 'XK') return 'Kosovo'
  let n = names.get(locale)
  if (!n) names.set(locale, (n = new Intl.DisplayNames([locale === 'en' ? 'en-GB' : 'ro-RO'], { type: 'region' })))
  try {
    return n.of(code) ?? code
  } catch {
    return code
  }
}

/** Romania first, then every other country by its name in the visitor's language. */
export function countryOptions(locale: Locale): { code: string; name: string }[] {
  const collator = new Intl.Collator(locale === 'en' ? 'en-GB' : 'ro-RO')
  const rest = COUNTRY_CODES.filter((c) => c !== 'RO')
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => collator.compare(a.name, b.name))
  return [{ code: 'RO', name: countryName('RO', locale) }, ...rest]
}
