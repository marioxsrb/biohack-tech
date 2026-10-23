/**
 * The variables each approved email uses (Email Studio, all 59 approved 23.10.2026; read from the approved HTML that
 * was uploaded to GoHighLevel, where each {{name}} is the contact field contact.bt_<name>). A live send fills every one
 * of them or does not go: an email never reaches a customer with a raw {{variable}}.
 *
 * {{unsubscribe_url}} is in every email; the bf_* values (Black Friday) are not contact fields yet, so those emails
 * cannot be sent live until they are set (docs/VOUCHERS-WORKFLOWS.md §18).
 */
export const UNSUBSCRIBE_VARIABLE = 'unsubscribe_url'

export const TEMPLATE_VARIABLES: Record<string, string[]> = {
  'abandoned-cart-01': ['cart_items', 'checkout_url'],
  'abandoned-cart-02': ['cart_items', 'checkout_url'],
  'abandoned-cart-03': ['cart_items', 'cart_product_benefits', 'checkout_url'],
  'abandoned-cart-04': ['checkout_url', 'product_name', 'voucher_amount', 'voucher_expiry'],
  'anul-nou-01': [],
  'anul-nou-02': ['product_name', 'voucher_amount', 'voucher_expiry', 'voucher_url'],
  'anul-nou-03': [],
  'anul-nou-04': [],
  'anul-nou-05': [],
  'anul-nou-06': ['product_name', 'voucher_amount', 'voucher_expiry', 'voucher_url'],
  'black-friday-01': [],
  'black-friday-02': [],
  'black-friday-03': ['bf_discount_amber', 'bf_discount_calm', 'bf_discount_focus', 'bf_end_date'],
  'black-friday-04': ['bf_discount_amber', 'bf_discount_calm', 'bf_discount_focus', 'bf_end_date'],
  'black-friday-05': ['bf_discount_amber', 'bf_discount_calm', 'bf_discount_focus', 'bf_end_time'],
  'craciun-01': [],
  'craciun-02': [],
  'craciun-03': ['product_name', 'voucher_amount', 'voucher_expiry', 'voucher_url'],
  'craciun-04': [],
  'educatie-01': [],
  'educatie-02': [],
  'educatie-03': [],
  'educatie-04': [],
  'educatie-05': [],
  'educatie-06': [],
  'educatie-07': [],
  'educatie-08': [],
  'landing-amber-01': ['voucher_url'],
  'landing-amber-02': [],
  'landing-amber-03': ['voucher_url'],
  'landing-calm-01': ['voucher_url'],
  'landing-calm-02': [],
  'landing-calm-03': [],
  'landing-calm-04': [],
  'landing-calm-05': [],
  'landing-focus-01': ['voucher_url'],
  'landing-focus-02': [],
  'landing-focus-03': [],
  'landing-focus-04': [],
  'landing-focus-05': [],
  'nudge-01': [],
  'nudge-02': ['product_name', 'voucher_amount', 'voucher_expiry', 'voucher_url'],
  'post-purchase-01': ['product_first_steps'],
  'post-purchase-02': ['product_name', 'product_usage_tips'],
  'post-purchase-03': ['product_name', 'review_url'],
  'post-purchase-04': ['complementary_product_recommendation', 'product_name', 'recommendation_url'],
  'referral-01': ['referral_url'],
  'vip-01': ['reward_url'],
  'welcome-01': [],
  'welcome-02': [],
  'welcome-03': [],
  'welcome-04': [],
  'welcome-05': [],
  'welcome-06': [],
  'welcome-07': [],
  'welcome-08': [],
  'welcome-09': [],
  'win-back-01': [],
  'win-back-02': ['product_name', 'voucher_amount', 'voucher_expiry', 'voucher_url'],
}

export const templateVariables = (template: string) => [...(TEMPLATE_VARIABLES[template] ?? []), UNSUBSCRIBE_VARIABLE]
