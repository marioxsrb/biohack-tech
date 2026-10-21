/**
 * The 14 email workflows and their 59 approved emails (Email Studio, 20.10.2026), as the store's automation sees them:
 * which email goes when, what stops or pauses a sequence, which voucher an email needs, how they rank. The texts live
 * in Email Studio and in the CRM; nothing here holds or changes copy. Template ids are Email Studio's ids.
 *
 * Nothing is sent from here (server/workflows/*): WORKFLOWS_MODE is 'off' unless set to 'dry_run', which only records
 * what would be sent. Sending (through the Biohack Tech GoHighLevel sub-account) is a later, approved step.
 */
import type { ProductId } from '@/content/catalog'
import type { VoucherSource } from './vouchers'

export type WorkflowId =
  | 'welcome'
  | 'landing-calm'
  | 'landing-focus'
  | 'landing-amber'
  | 'abandoned-cart'
  | 'educatie'
  | 'post-purchase'
  | 'referral'
  | 'vip'
  | 'win-back'
  | 'nudge'
  | 'black-friday'
  | 'craciun'
  | 'anul-nou'

/** One email of a sequence: its delay after the enrollment starts (relative) or its calendar day (seasonal). */
export type Step = {
  template: string
  /** Hours after the enrollment's start (relative workflows). */
  afterHours?: number
  /** Calendar day "MM-DD" (seasonal workflows; the year comes from the campaign). */
  on?: string
  /** Promotional email: counts towards the weekly limit and needs marketing consent. A service email (a guide) does not. */
  promotional: boolean
  /** The email states a voucher: it is sent only once the voucher exists (issued or reused) for the contact. */
  voucher?: 'product' | 'cart'
  /** Black Friday 04/05: only when the campaign says so (the offers continue, the real last day). */
  onlyIf?: 'bf_offers_continue' | 'bf_last_day'
}

export type Workflow = {
  id: WorkflowId
  /** Lower runs first when two would send to the same contact; the cap defers the lower ones. */
  priority: number
  kind: 'relative' | 'seasonal' | 'single'
  /** The product a landing sequence is about (its purchase stops it; its voucher is issued for it). */
  product?: ProductId
  /** Where the voucher of this workflow comes from (its validity: config/vouchers.ts). */
  voucherSource?: VoucherSource
  steps: Step[]
  /** Stops for good when the contact buys (any product, or the workflow's product). */
  stopOnPurchase: 'any' | 'product' | 'never'
  /** While the contact is in one of these, this sequence waits (and resumes after). */
  pausedBy: WorkflowId[]
  /** Never at the same time as these (the later enrollment is refused). */
  exclusiveWith: WorkflowId[]
  /** Sent even when the weekly limit is reached (the customer's own action started it). */
  capExempt?: boolean
}

const d = (days: number) => days * 24
const rel = (id: string, days: number[], promotional = true): Step[] => days.map((x, i) => ({ template: `${id}-${String(i + 1).padStart(2, '0')}`, afterHours: d(x), promotional }))

export const WORKFLOWS: Record<WorkflowId, Workflow> = {
  // Abandoned checkout, 4 emails in 6 days (replaces the 3 recovery emails); voucher only in the 4th, per product type.
  'abandoned-cart': {
    id: 'abandoned-cart',
    priority: 1,
    kind: 'relative',
    voucherSource: 'abandoned-cart',
    steps: [
      { template: 'abandoned-cart-01', afterHours: 1, promotional: true },
      { template: 'abandoned-cart-02', afterHours: 20, promotional: true },
      { template: 'abandoned-cart-03', afterHours: d(3), promotional: true },
      { template: 'abandoned-cart-04', afterHours: d(6), promotional: true, voucher: 'cart' },
    ],
    stopOnPurchase: 'any',
    pausedBy: [],
    exclusiveWith: [],
    capExempt: true,
  },
  // One per order (deduplicated per contact while active), at most 4 emails; guides are service emails.
  'post-purchase': {
    id: 'post-purchase',
    priority: 2,
    kind: 'relative',
    steps: [
      { template: 'post-purchase-01', afterHours: 0, promotional: false },
      { template: 'post-purchase-02', afterHours: d(3), promotional: false },
      { template: 'post-purchase-03', afterHours: d(7), promotional: false },
      { template: 'post-purchase-04', afterHours: d(14), promotional: true },
    ],
    stopOnPurchase: 'never',
    pausedBy: [],
    exclusiveWith: [],
  },
  'landing-calm': { id: 'landing-calm', priority: 3, kind: 'relative', product: 'balance-wave', voucherSource: 'landing-calm', steps: withVoucher(rel('landing-calm', [0, 3, 7, 14, 21])), stopOnPurchase: 'product', pausedBy: ['abandoned-cart'], exclusiveWith: [] },
  'landing-focus': { id: 'landing-focus', priority: 3, kind: 'relative', product: 'brainlink-pro', voucherSource: 'landing-focus', steps: withVoucher(rel('landing-focus', [0, 3, 7, 14, 21])), stopOnPurchase: 'product', pausedBy: ['abandoned-cart'], exclusiveWith: [] },
  'landing-amber': { id: 'landing-amber', priority: 3, kind: 'relative', product: 'ochelari-biohack', voucherSource: 'landing-amber', steps: withVoucher(rel('landing-amber', [0, 3, 7])), stopOnPurchase: 'product', pausedBy: ['abandoned-cart'], exclusiveWith: [] },
  referral: { id: 'referral', priority: 4, kind: 'single', steps: [{ template: 'referral-01', afterHours: 0, promotional: true }], stopOnPurchase: 'never', pausedBy: [], exclusiveWith: [] },
  vip: { id: 'vip', priority: 4, kind: 'single', steps: [{ template: 'vip-01', afterHours: 0, promotional: true }], stopOnPurchase: 'never', pausedBy: [], exclusiveWith: [] },
  // Welcome and Educație may run side by side, within the weekly limit.
  welcome: { id: 'welcome', priority: 5, kind: 'relative', steps: rel('welcome', [0, 3, 7, 12, 17, 22, 28, 35, 42]), stopOnPurchase: 'never', pausedBy: ['abandoned-cart'], exclusiveWith: [] },
  educatie: { id: 'educatie', priority: 6, kind: 'relative', steps: rel('educatie', [0, 5, 10, 15, 20, 25, 32, 40]), stopOnPurchase: 'never', pausedBy: ['abandoned-cart'], exclusiveWith: [] },
  'win-back': {
    id: 'win-back',
    priority: 7,
    kind: 'relative',
    voucherSource: 'win-back',
    // "La 7–14 zile după Emailul 01, în funcție de segment": 7 by default (data.secondAfterDays per enrollment).
    steps: [
      { template: 'win-back-01', afterHours: 0, promotional: true },
      { template: 'win-back-02', afterHours: d(7), promotional: true, voucher: 'product' },
    ],
    stopOnPurchase: 'any',
    pausedBy: ['abandoned-cart', 'post-purchase'],
    exclusiveWith: ['nudge'],
  },
  nudge: {
    id: 'nudge',
    priority: 7,
    kind: 'relative',
    voucherSource: 'nudge',
    steps: [
      { template: 'nudge-01', afterHours: 0, promotional: true },
      { template: 'nudge-02', afterHours: d(7), promotional: true, voucher: 'product' },
    ],
    stopOnPurchase: 'any',
    pausedBy: ['abandoned-cart', 'post-purchase'],
    exclusiveWith: ['win-back'],
  },
  'black-friday': {
    id: 'black-friday',
    priority: 8,
    kind: 'seasonal',
    // Days relative to Black Friday (the campaign sets the date): −14, −3, 0, +2, +7.
    steps: [
      { template: 'black-friday-01', afterHours: d(-14), promotional: true },
      { template: 'black-friday-02', afterHours: d(-3), promotional: true },
      { template: 'black-friday-03', afterHours: 0, promotional: true },
      { template: 'black-friday-04', afterHours: d(2), promotional: true, onlyIf: 'bf_offers_continue' },
      { template: 'black-friday-05', afterHours: d(7), promotional: true, onlyIf: 'bf_last_day' },
    ],
    stopOnPurchase: 'never',
    pausedBy: ['abandoned-cart'],
    exclusiveWith: [],
  },
  craciun: {
    id: 'craciun',
    priority: 8,
    kind: 'seasonal',
    voucherSource: 'craciun',
    steps: [
      { template: 'craciun-01', on: '12-01', promotional: true },
      { template: 'craciun-02', on: '12-08', promotional: true },
      { template: 'craciun-03', on: '12-15', promotional: true, voucher: 'product' },
      // A wish only, no offer: still a marketing email (consent), never deferred past the day.
      { template: 'craciun-04', on: '12-24', promotional: true },
    ],
    stopOnPurchase: 'never',
    pausedBy: ['abandoned-cart'],
    exclusiveWith: [],
  },
  'anul-nou': {
    id: 'anul-nou',
    priority: 8,
    kind: 'seasonal',
    voucherSource: 'anul-nou',
    steps: [
      { template: 'anul-nou-01', on: '12-27', promotional: true },
      { template: 'anul-nou-02', on: '12-29', promotional: true, voucher: 'product' },
      { template: 'anul-nou-03', on: '01-02', promotional: true },
      { template: 'anul-nou-04', on: '01-07', promotional: true },
      { template: 'anul-nou-05', on: '01-15', promotional: true },
      // Reuses the voucher of 02 while it is active (anul-nou notes, rule 5).
      { template: 'anul-nou-06', on: '01-31', promotional: true, voucher: 'product' },
    ],
    stopOnPurchase: 'never',
    pausedBy: ['abandoned-cart'],
    exclusiveWith: [],
  },
}

/** A landing sequence's first email states the voucher the popup gave (the same one, never a new benefit). */
function withVoucher(steps: Step[]): Step[] {
  return steps.map((s, i) => (i === 0 ? { ...s, voucher: 'product' } : s))
}

/** "Maximum 2–3 emailuri promoționale săptămânal" per contact: the rolling 7-day limit (WORKFLOWS_WEEKLY_LIMIT, 2 or 3). */
export const WEEKLY_PROMO_LIMIT = 3

export const ALL_TEMPLATES = Object.values(WORKFLOWS).flatMap((w) => w.steps.map((s) => s.template))
