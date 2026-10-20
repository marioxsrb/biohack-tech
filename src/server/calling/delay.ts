/** When the first AI call of a lead (an unfinished checkout) may happen: its quiet time. */
import type { CallingConfig } from '@/server/config'

/**
 * Minutes of quiet before the first call: 20 after the cart's last change; in test mode, and only for a number on
 * the test list, the short test delay. Real customers never get the test delay.
 */
export function firstCallDelay(c: Pick<CallingConfig, 'delays' | 'testMode' | 'testNumbers' | 'testDelayMinutes'>, phone: string | null) {
  if (c.testMode && phone && c.testNumbers?.includes(phone)) return c.testDelayMinutes
  return c.delays.cart
}
