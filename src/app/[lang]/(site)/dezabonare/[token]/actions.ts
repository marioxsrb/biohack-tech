'use server'

import { redirect } from 'next/navigation'
import { getDb } from '@/server/db'
import { kickJobs } from '@/server/jobs/runner'
import { marketing } from '@/server/marketing/consent'
import { withdrawMarketing } from '@/server/marketing/unsubscribe'

/** The token alone identifies the address; an unknown token changes nothing. */
export async function unsubscribeAction(f: FormData) {
  const token = String(f.get('token') ?? '')
  const email = await marketing.emailForToken(await getDb(), token)
  if (email && (await withdrawMarketing(email, 'unsubscribe_link', '/dezabonare'))) kickJobs()
  redirect(`/dezabonare/${encodeURIComponent(token)}?gata=1`)
}
