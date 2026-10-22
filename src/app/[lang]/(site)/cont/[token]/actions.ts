'use server'

import { redirect } from 'next/navigation'
import { accountEmail } from '@/server/account'
import { getDb } from '@/server/db'
import { log } from '@/server/log'
import { claimReward } from '@/server/rewards'

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
