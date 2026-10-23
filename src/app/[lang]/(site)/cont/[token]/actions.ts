'use server'

import { redirect } from 'next/navigation'
import { AD_CONSENT_VERSION, accountEmail, ownsOrder } from '@/server/account'
import { getDb } from '@/server/db'
import { log } from '@/server/log'
import { claimReward, setAdConsent } from '@/server/rewards'
import { audit } from '@/server/store-settings'

/**
 * The customer chooses a reward (a gift, or for Referral and VIP a standard voucher): only for the address in the
 * signed link, only one of its own rewards, once (a second choice returns the first code).
 */
export async function chooseRewardAction(f: FormData) {
  const token = String(f.get('t') ?? '')
  const email = accountEmail(token)
  const rewardId = String(f.get('reward') ?? '')
  const [kind, productId] = String(f.get('choice') ?? '').split(':')
  if (!email || !/^[0-9a-f-]{36}$/i.test(rewardId) || (kind !== 'gift' && kind !== 'voucher') || !productId) redirect(`/cont/${encodeURIComponent(token)}?r=eroare`)
  const db = await getDb()
  const owner = await db.query('select 1 from rewards where id = $1 and email = $2', [rewardId, email])
  if (!owner.rows.length) redirect(`/cont/${encodeURIComponent(token)}?r=eroare`)
  const r = await db.tx((t) => claimReward(t, rewardId, { kind: kind as 'gift' | 'voucher', productId }, 'customer'))
  log.info('reward.chosen', { ok: r.ok })
  redirect(`/cont/${encodeURIComponent(token)}?r=${r.ok ? 'ales' : 'eroare'}#recompense`)
}

/**
 * The customer gives (before the review is decided) or withdraws (at any time) the review video licence, for one of
 * their own orders. Every change is recorded in the audit with the text version.
 */
export async function adConsentAction(f: FormData) {
  const token = String(f.get('t') ?? '')
  const email = accountEmail(token)
  const orderId = String(f.get('order') ?? '')
  const give = f.get('consent') === 'da'
  const back = `/cont/${encodeURIComponent(token)}`
  if (!email || (!give && f.get('consent') !== 'nu')) redirect(`${back}?r=eroare`)
  const db = await getDb()
  if (!(await ownsOrder(db, email, orderId))) redirect(`${back}?r=eroare`)
  const changed = await db.tx(async (t) => {
    const ok = await setAdConsent(t, orderId, give, AD_CONSENT_VERSION)
    if (ok) await audit(t, 'customer', give ? 'video_review.consent_given' : 'video_review.consent_withdrawn', { orderId, version: give ? AD_CONSENT_VERSION : null })
    return ok
  })
  log.info('review.consent', { give, changed })
  redirect(`${back}?r=${changed ? (give ? 'acord' : 'retras') : 'eroare'}#review`)
}
