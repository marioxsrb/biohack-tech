/**
 * Black Friday 2026, Brain Event: a Shopify buyer leaves the Brain Event Black Friday workflow.
 * Brain Event has no Shopify integration, so a Shopify Flow ("Order created" → HTTP request) calls
 * /api/webhooks/shopify-order with the order's email.
 *
 * Safety: the contact is only looked up by email (never created or updated), only contacts carrying the
 * campaign tag are touched, and only this one workflow in this one sub-account. Off unless BF_BUYER_STOP is
 * "dry" (everything is looked up and logged, nothing is removed) or "live".
 */
import 'server-only'
import type { GhlConfig } from '@/server/config'
import { ghl } from '@/server/integrations/ghl'

export const BF_BUYER_STOP = {
  locationId: 'r7vVLgPNRqJaEPUCZdOt',
  workflowId: '2faa89c2-33ca-4614-a570-25d9ff228cbf',
  tag: 'bt-bf26',
} as const

export type BuyerStopMode = 'off' | 'dry' | 'live'
export type BuyerStopResult = { matched: number; enrolled: number; removed: number; dryRun: boolean }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const validBuyerEmail = (email: unknown): email is string => typeof email === 'string' && email.length <= 254 && EMAIL.test(email.trim())

export async function stopBuyer(target: GhlConfig, email: string, mode: Exclude<BuyerStopMode, 'off'>): Promise<BuyerStopResult> {
  if (target.locationId !== BF_BUYER_STOP.locationId) throw new Error('bf buyer stop: wrong sub-account')
  const contacts = await ghl.contactsByEmail(target, email)
  const enrolled = contacts.filter((x) => x.tags.includes(BF_BUYER_STOP.tag))
  if (mode === 'live') for (const x of enrolled) await ghl.removeFromWorkflow(target, x.id, BF_BUYER_STOP.workflowId)
  return { matched: contacts.length, enrolled: enrolled.length, removed: mode === 'live' ? enrolled.length : 0, dryRun: mode === 'dry' }
}
