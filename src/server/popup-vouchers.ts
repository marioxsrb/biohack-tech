/**
 * The landing popups' switch from the 10% code to the product's fixed voucher (prepared 21.10.2026, OFF):
 * Calm 640 lei, Focus 325 lei, Amber 30 lei per paid pair (config/vouchers.ts), personal, 30 days.
 *
 * POPUP_VOUCHERS=on (only after the popup's and the welcome email's new texts are approved): a signup on the Calm, Focus
 * or Amber popup (its landing, or its product page) gets that product's voucher instead of LONGEVITY10, and enters
 * the landing sequence, whose first email states the voucher. A contact who already bought the product, or used
 * its voucher, is not given it again (server/vouchers.ts voucherEligibility): the popup's 10% email goes as today.
 *
 * Off (the default) changes nothing: every popup sends the code it sends today. The codes already promised
 * (LONGEVITY10, BIOHACK10, CADOU1233, CADOU100) stay valid either way; nothing here deactivates a code.
 */
import 'server-only'
import type { VoucherProduct } from '@/config/vouchers'
import type { WorkflowId } from '@/config/workflows'
import type { LandingSlug } from '@/lib/landing-hosts'
import type { Queryable } from '@/server/db'
import { issueVoucher } from '@/server/vouchers'
import { enroll } from '@/server/workflows/engine'
import { ghlWorkflowsConfig } from '@/server/workflows/ghl-map'

/**
 * On only with POPUP_VOUCHERS=on AND the Biohack Tech GHL sub-account configured (GHL_WF_TOKEN, GHL_WF_LOCATION_ID):
 * the voucher replaces the 10% email, so the landing sequence's first email (sent by the sub-account) must exist,
 * or the customer would get a voucher and no email at all. Switching it on also needs that sending live (§5 of
 * docs/VOUCHERS-WORKFLOWS.md) and the new popup texts approved.
 */
export const popupVouchersOn = (env: Record<string, string | undefined> = process.env) => env.POPUP_VOUCHERS === 'on' && !!ghlWorkflowsConfig(env)

const BY_SLUG: Record<LandingSlug, { product: VoucherProduct; workflow: WorkflowId & `landing-${string}` }> = {
  calm: { product: 'balance-wave', workflow: 'landing-calm' },
  focus: { product: 'brainlink-pro', workflow: 'landing-focus' },
  amber: { product: 'ochelari-biohack', workflow: 'landing-amber' },
}

/** Which product's popup this was: its landing host, or its page (/products/calm, /lp/calm...). Null: the main site's. */
export function popupProduct(page: string | null, landing: LandingSlug | null) {
  if (landing) return BY_SLUG[landing]
  const m = page?.match(/^\/(?:ro\/)?(?:products|lp)\/(calm|focus|amber)(?:[/?#]|$)/)
  return m ? BY_SLUG[m[1] as LandingSlug] : null
}

/**
 * Inside the signup's transaction: the voucher (or the active one reused) and the landing sequence. Returns null
 * when the contact cannot have it (the 10% email goes instead).
 */
export async function popupVoucher(t: Queryable, email: string, which: { product: VoucherProduct; workflow: WorkflowId }) {
  const issued = await issueVoucher(t, { email, productId: which.product, source: which.workflow as 'landing-calm' | 'landing-focus' | 'landing-amber', actor: 'popup' })
  if (!issued.ok) return null
  await enroll(t, { email, workflow: which.workflow, ref: email.trim().toLowerCase(), data: { voucherId: issued.voucher.id, productId: which.product } })
  return issued.voucher
}
