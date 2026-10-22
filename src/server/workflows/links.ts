/**
 * The personal links the approved emails' CTAs use (Email Studio, 22.10.2026), built by the store for one contact:
 *   {{voucher_url}}         the voucher's product page with the code in the checkout (the address in a signed link);
 *   {{review_url}}          the review video upload for one delivered order;
 *   {{reward_url}}          the account's rewards (choose the gift or voucher);
 *   {{referral_url}}        the customer's referral link (the friend lands with the code);
 *   {{recommendation_url}}  the complementary product's page (a product not owned yet), or the catalog.
 * Every link that opens personal data is signed (server/account.ts) and expires; none carries the email in clear.
 */
import 'server-only'
import { catalogProduct } from '@/content/catalog'
import { accountToken } from '@/server/account'

const abs = (site: string, path: string) => `${site.replace(/\/$/, '')}${path}`

export function voucherUrl(site: string, email: string, code: string) {
  const t = accountToken(email)
  return t ? abs(site, `/api/cont/folosire?t=${t}&cod=${encodeURIComponent(code)}`) : null
}
export function reviewUrl(site: string, email: string, orderId: string) {
  const t = accountToken(email)
  return t ? abs(site, `/cont/${t}/review/${orderId}`) : null
}
export function rewardUrl(site: string, email: string) {
  const t = accountToken(email)
  return t ? abs(site, `/cont/${t}#recompense`) : null
}
export const referralUrl = (site: string, code: string) => abs(site, `/api/recomandare?cod=${encodeURIComponent(code)}`)
export function recommendationUrl(site: string, productId: string | null | undefined) {
  const slug = productId ? catalogProduct(productId)?.slug : null
  return abs(site, slug ? `/products/${slug}` : '/products')
}
