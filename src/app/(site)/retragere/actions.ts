'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { normalizeWithdrawal, recordWithdrawal, validateWithdrawal, type WithdrawalField } from '@/server/orders/withdrawal'

export type WithdrawalFormState = { errors?: Partial<Record<WithdrawalField, string>>; message?: string; values?: Record<string, string> }

export async function withdrawAction(_prev: WithdrawalFormState, f: FormData): Promise<WithdrawalFormState> {
  const raw = Object.fromEntries(['name', 'email', 'orderNumber', 'items', 'message'].map((k) => [k, String(f.get(k) ?? '')]))
  if (!rateLimit(`withdrawal:${clientIp(await headers())}`, 10, 60 * 60_000)) {
    return { values: raw, message: 'Prea multe cereri într-un timp scurt. Încearcă din nou peste o oră sau scrie-ne pe email.' }
  }
  const input = normalizeWithdrawal(raw)
  const errors = validateWithdrawal(input)
  if (Object.keys(errors).length) return { errors, values: raw }
  let reference: string
  try {
    ;({
      withdrawal: { reference },
    } = await recordWithdrawal(input))
  } catch (e) {
    log.error('withdrawal.failed', { error: errText(e) })
    return { values: raw, message: 'Nu am putut înregistra cererea. Încearcă din nou sau trimite-ne declarația pe email.' }
  }
  kickJobs()
  redirect(`/retragere/confirmare?ref=${encodeURIComponent(reference)}`)
}
