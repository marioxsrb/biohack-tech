/**
 * The decision for one enrollment, pure and deterministic (no database, no clock of its own): send the next email,
 * wait (until when, and why), skip a step, stop, or finish. The engine (engine.ts) gathers the facts and applies it.
 *
 * Order of the rules:
 *   1. a purchase stops what it should stop (any purchase, or the workflow's product);
 *   2. nothing left: complete;
 *   3. not yet due: wait;
 *   4. a promotional email needs marketing consent (an unsubscribe stops the sequence; a service email still goes);
 *   5. a higher-priority sequence in progress pauses this one (abandoned checkout pauses the landing sequences...);
 *   6. a campaign-only step whose condition is false, or a calendar email whose day has passed: skipped;
 *   7. an email that states a voucher waits for the voucher; one that cannot have it (already bought...) is skipped;
 *   8. the weekly limit of promotional emails defers it (except the sequences the customer's own action started).
 */
import { WEEKLY_PROMO_LIMIT, WORKFLOWS, type Step, type WorkflowId } from '@/config/workflows'

export type Enrollment = { workflow: WorkflowId; step: number; startedAt: Date; data?: { secondAfterDays?: number } }

export type Facts = {
  now: Date
  /** Marketing consent granted and not withdrawn (an unsubscribe withdraws it). */
  consent: boolean
  /** Products bought (an order that stands) since the enrollment started. */
  purchasedSince: string[]
  /** The contact's other active enrollments. */
  activeOther: WorkflowId[]
  /** When the contact's promotional emails of the last 7 days went (or were recorded as dry runs). */
  promoSent: Date[]
  /** For a step that states a voucher: whether the contact has it (or can be given it), or cannot have it. */
  voucher?: 'ready' | 'refused'
  campaign?: { bf_offers_continue?: boolean; bf_last_day?: boolean }
  limit?: number
}

export type Decision =
  | { action: 'send'; step: number; template: string; promotional: boolean }
  | { action: 'wait'; until: Date; reason: string }
  | { action: 'skip'; step: number; template: string; reason: string }
  | { action: 'stop'; reason: string }
  | { action: 'complete' }

const HOUR = 3_600_000
/** How long a paused sequence waits before it looks again. */
export const PAUSE_RECHECK_MS = 6 * HOUR
/** A calendar email still goes this long after its day began (then it is skipped, never sent late). */
export const CALENDAR_GRACE_MS = 24 * HOUR

/** When step `i` is due. Relative: after the start; seasonal by day: that day, 09:00 Romania (07:00 UTC in winter). */
export function dueAt(e: Enrollment, i: number): Date {
  const wf = WORKFLOWS[e.workflow]
  const s = wf.steps[i]
  if (s.on) {
    const [m, day] = s.on.split('-').map(Number)
    const anchor = e.startedAt
    // A campaign that starts in December and ends in January: January days are in the next year.
    const year = anchor.getUTCFullYear() + (m < anchor.getUTCMonth() + 1 ? 1 : 0)
    return new Date(Date.UTC(year, m - 1, day, 7, 0, 0))
  }
  let hours = s.afterHours ?? 0
  // Win-back's second email: 7–14 days after the first, per segment.
  if ((e.workflow === 'win-back' || e.workflow === 'nudge') && i === 1 && e.data?.secondAfterDays) hours = Math.min(14, Math.max(7, e.data.secondAfterDays)) * 24
  return new Date(e.startedAt.getTime() + hours * HOUR)
}

export function decide(e: Enrollment, f: Facts): Decision {
  const wf = WORKFLOWS[e.workflow]
  if (wf.stopOnPurchase === 'any' && f.purchasedSince.length) return { action: 'stop', reason: 'purchased' }
  if (wf.stopOnPurchase === 'product' && wf.product && f.purchasedSince.includes(wf.product)) return { action: 'stop', reason: 'purchased_product' }
  if (e.step >= wf.steps.length) return { action: 'complete' }
  const s: Step = wf.steps[e.step]
  const due = dueAt(e, e.step)
  if (f.now < due) return { action: 'wait', until: due, reason: 'not_due' }
  if (s.promotional && !f.consent) return { action: 'stop', reason: 'no_consent' }
  const pausedBy = wf.pausedBy.find((w) => f.activeOther.includes(w))
  if (pausedBy) return { action: 'wait', until: new Date(f.now.getTime() + PAUSE_RECHECK_MS), reason: `paused_by_${pausedBy}` }
  if (s.onlyIf && !f.campaign?.[s.onlyIf]) return { action: 'skip', step: e.step, template: s.template, reason: `condition_${s.onlyIf}` }
  if (s.on && f.now.getTime() > due.getTime() + CALENDAR_GRACE_MS) return { action: 'skip', step: e.step, template: s.template, reason: 'day_passed' }
  if (s.voucher) {
    if (f.voucher === 'refused') return { action: 'skip', step: e.step, template: s.template, reason: 'no_voucher' }
    if (f.voucher !== 'ready') return { action: 'wait', until: new Date(f.now.getTime() + HOUR), reason: 'voucher_pending' }
  }
  if (s.promotional && !wf.capExempt) {
    const limit = f.limit ?? WEEKLY_PROMO_LIMIT
    const week = f.promoSent.filter((t) => t.getTime() > f.now.getTime() - 7 * 24 * HOUR).sort((a, b) => a.getTime() - b.getTime())
    if (week.length >= limit) {
      const until = new Date(week[week.length - limit].getTime() + 7 * 24 * HOUR)
      // A calendar email deferred past its day is skipped instead (never a Christmas email in January).
      if (s.on && until.getTime() > due.getTime() + CALENDAR_GRACE_MS) return { action: 'skip', step: e.step, template: s.template, reason: 'weekly_limit_day_passed' }
      return { action: 'wait', until, reason: 'weekly_limit' }
    }
  }
  return { action: 'send', step: e.step, template: s.template, promotional: s.promotional }
}

/** When two enrollments of a contact are due together, the higher priority goes first (lower number). */
export const byPriority = (a: { workflow: WorkflowId }, b: { workflow: WorkflowId }) => WORKFLOWS[a.workflow].priority - WORKFLOWS[b.workflow].priority
