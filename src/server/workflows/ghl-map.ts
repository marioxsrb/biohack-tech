/**
 * What the Biohack Tech GoHighLevel sub-account will receive for the email workflows (prepared 21.10.2026, never
 * called here). The store stays the source of truth (orders, vouchers, consent, the planner's decisions); GHL only
 * sends the approved email the store tells it to, with the values it needs:
 *   - one tag per email to send (bt-wf-<template>), added by the store when the planner says "send": each GHL
 *     workflow is just "tag added → send this email → remove tag". The order, the waits, the stops, the weekly limit
 *     and the priorities are decided by the store, so two systems never disagree about who gets what;
 *   - interest segments (bt-interes-calm/focus/amber/carte) and purchase tags (bt-cumparat-*, as today);
 *   - the variables as contact custom fields, set in the same update as the tag.
 * Credentials (separate sub-account): GHL_WF_TOKEN + GHL_WF_LOCATION_ID. Until they exist, and until sending is
 * approved, nothing is sent: this module only builds the update (tested).
 */
import type { WorkflowId } from '@/config/workflows'

/** Contact custom field keys for the workflows (create them in the sub-account with these exact keys). */
export const WORKFLOW_FIELDS = {
  voucherCode: 'contact.bt_voucher_code',
  voucherAmount: 'contact.bt_voucher_amount',
  voucherExpiry: 'contact.bt_voucher_expiry',
  voucherUrl: 'contact.bt_voucher_url',
  productName: 'contact.bt_product_name',
  cartItems: 'contact.bt_cart_items',
  cartBenefits: 'contact.bt_cart_product_benefits',
  cartVouchers: 'contact.bt_cart_eligible_vouchers',
  checkoutUrl: 'contact.bt_checkout_url',
  firstSteps: 'contact.bt_product_first_steps',
  usageTips: 'contact.bt_product_usage_tips',
  recommendation: 'contact.bt_complementary_product_recommendation',
  referralUrl: 'contact.bt_referral_url',
  reviewUrl: 'contact.bt_review_url',
  rewardUrl: 'contact.bt_reward_url',
  recommendationUrl: 'contact.bt_recommendation_url',
  unsubscribeUrl: 'contact.bt_unsubscribe_url',
} as const

/** The variable names of the approved emails, and the field each one reads. */
export const VARIABLE_FIELD: Record<string, keyof typeof WORKFLOW_FIELDS> = {
  voucher_amount: 'voucherAmount',
  voucher_expiry: 'voucherExpiry',
  product_name: 'productName',
  cart_items: 'cartItems',
  cart_product_benefits: 'cartBenefits',
  cart_eligible_vouchers: 'cartVouchers',
  checkout_url: 'checkoutUrl',
  product_first_steps: 'firstSteps',
  product_usage_tips: 'usageTips',
  complementary_product_recommendation: 'recommendation',
  // The CTA links (server/workflows/links.ts).
  voucher_url: 'voucherUrl',
  review_url: 'reviewUrl',
  reward_url: 'rewardUrl',
  referral_url: 'referralUrl',
  recommendation_url: 'recommendationUrl',
  unsubscribe_url: 'unsubscribeUrl',
}

export const INTEREST_SEGMENT: Record<string, string> = {
  'balance-wave': 'bt-interes-calm',
  'brainlink-pro': 'bt-interes-focus',
  'ochelari-biohack': 'bt-interes-amber',
  'carte-diana': 'bt-interes-carte',
}

export const sendTag = (template: string) => `bt-wf-${template}`

export type WorkflowSend = {
  workflow: WorkflowId
  template: string
  email: string
  interests?: string[]
  values?: Partial<Record<keyof typeof WORKFLOW_FIELDS, string>>
}

/** The contact update that makes the sub-account send one approved email (tag + its values). */
export function contactUpdate(s: WorkflowSend) {
  const tags = [sendTag(s.template), ...new Set((s.interests ?? []).map((p) => INTEREST_SEGMENT[p]).filter(Boolean))]
  const customFields = Object.entries(s.values ?? {})
    .filter(([, v]) => typeof v === 'string')
    .map(([k, v]) => ({ key: WORKFLOW_FIELDS[k as keyof typeof WORKFLOW_FIELDS], field_value: v as string }))
  return { email: s.email.trim().toLowerCase(), tags, customFields }
}

/** The values an email needs that the update does not carry: sending it would show a raw {{variable}}. */
export function missingValues(variables: string[], values: WorkflowSend['values'] = {}) {
  return variables.filter((v) => {
    const f = VARIABLE_FIELD[v]
    return !f || !values[f]
  })
}

export function ghlWorkflowsConfig(env: Record<string, string | undefined> = process.env) {
  const token = env.GHL_WF_TOKEN
  const locationId = env.GHL_WF_LOCATION_ID
  return token && locationId ? { token, locationId } : null
}
