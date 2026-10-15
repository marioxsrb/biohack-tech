/** When the first AI call of a lead may happen: the two scenarios and their quiet times. */
import type { Lead } from '@/server/leads'
import type { CallingConfig } from '@/server/config'

/** Why a lead is called: an unfinished checkout with a cart, or a price asked for on acces.<domain>. */
export type CallScenario = 'cart' | 'price_reveal'
export const callScenario = (lead: Pick<Lead, 'productId'>): CallScenario => (lead.productId === 'cart' /* CART_INTEREST, not imported: leads.ts imports this module */ ? 'cart' : 'price_reveal')

/**
 * Minutes of quiet before the first call: 20 after a cart, 30 after the price form; in test mode, and only for a
 * number on the test list, the short test delay. Real customers never get the test delay.
 */
export function firstCallDelay(lead: Pick<Lead, 'productId'>, c: Pick<CallingConfig, 'delays' | 'testMode' | 'testNumbers' | 'testDelayMinutes'>, phone: string | null) {
  if (c.testMode && phone && c.testNumbers?.includes(phone)) return c.testDelayMinutes
  return c.delays[callScenario(lead)]
}
