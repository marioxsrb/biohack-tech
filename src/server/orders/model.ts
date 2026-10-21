/**
 * The canonical order. It exists in our database independently of Stripe, FGO or
 * GoHighLevel; those systems receive copies and references, never the other way round.
 *
 * Two separate state axes:
 *   OrderStatus   where the order is in its life (to prepare, shipped...)
 *   PaymentStatus what we know about the money
 */
import type { Attribution } from '@/lib/attribution'
import type { Currency } from '@/lib/currency'
import { countryName } from '@/lib/countries'
import type { AppliedPromotion } from '@/lib/promotions'

export const ORDER_STATUS = {
  pending: 'pending', // created, waiting for payment
  // confirmed: paid, or (cash on delivery) accepted and to be prepared before the money exists
  abandoned: 'abandoned', // card payment not completed in time (can still be paid)
  confirmed: 'confirmed', // paid, to be prepared
  processing: 'processing', // being prepared
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
} as const
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export const PAYMENT_STATUS = {
  pending: 'pending', // card payment started, not confirmed by Stripe
  awaitingTransfer: 'awaiting_transfer',
  /** Cash on delivery: the courier collects at the door; paid only once a person records the settlement. */
  awaitingCollection: 'awaiting_collection',
  failed: 'failed', // last card attempt failed; the customer can retry
  cancelled: 'cancelled', // the card payment was cancelled in Stripe before any money moved
  paid: 'paid',
  partiallyRefunded: 'partially_refunded',
  refunded: 'refunded',
} as const
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]

export const PAYMENT_METHOD = { card: 'card', bankTransfer: 'bank_transfer', cashOnDelivery: 'cash_on_delivery' } as const
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD]

/** How a payment method is named to people (customer pages, emails, admin, CRM, invoice text). */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  card: 'Card',
  bank_transfer: 'Transfer bancar',
  cash_on_delivery: 'Ramburs (plata la livrare)',
}

export const INVOICE_STATUS = {
  none: 'none', // not due yet
  pending: 'pending', // queued for FGO
  issued: 'issued',
  failed: 'failed', // FGO refused or kept failing: needs a person
  manual: 'manual', // FGO not configured or manual policy: issue by hand
} as const
export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS]

export type ReturnStatus = 'requested' | 'received'

/** `county`: the Romanian county, or the region/state abroad (may be empty). `country`: ISO 3166-1 alpha-2. */
export type Address = { address: string; city: string; county: string; postalCode: string; country: string }

export type Customer = {
  buyerType: 'pf' | 'pj'
  firstName: string
  lastName: string
  company?: string
  cui?: string
  regCom?: string
}

export type OrderItem = {
  position: number
  productId: string
  variantId: string | null
  productName: string
  variantName: string | null
  sku: string
  quantity: number
  unitPriceMinor: number
  /** quantity × unit price, before promotions. */
  lineTotalMinor: number
  /** This line's share of the order's promotions (0 when none). Invoiced amount = lineTotal − discount. */
  discountMinor: number
  promotionId: string | null
  /** The promo code's share of `discountMinor` (0 without a code). */
  codeDiscountMinor: number
}

/** A normal checkout order, or the optional one added right after a card payment (linked to its parent). */
export type OrderKind = 'checkout' | 'upsell'
export type UpsellStatus = 'offered' | 'declined' | 'accepted' | 'expired'

export type Order = {
  id: string
  orderNumber: string
  publicToken: string
  createdAt: Date
  updatedAt: Date
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  invoiceStatus: InvoiceStatus
  /** What the customer pays in: lei, or euro/dollar (the lei prices converted at the BNR rate, see lib/currency). */
  currency: Currency
  /** Lei for one unit of the order's currency when it was placed (1 for lei): reports and the invoice use it. */
  fxRate: number
  /** The language the customer ordered in: their emails and pages follow it. */
  locale: 'ro' | 'en'
  /** The site it was placed on: biohack-tech.ro, or the international biohack-tech.net. */
  site: OrderSite
  /** Sum of line totals before promotions. total = subtotal − discount + shipping. */
  subtotalMinor: number
  discountMinor: number
  promotions: AppliedPromotion[]
  /** The promo code used (its discount is among `promotions`, id `cod:<CODE>`), or null. */
  promoCode: string | null
  shippingMinor: number
  totalMinor: number
  refundedMinor: number
  email: string
  phone: string
  customer: Customer
  billingAddress: Address
  shippingAddress: Address
  notes: string
  marketingConsent: boolean
  stripePaymentIntentId: string | null
  /** Cash on delivery: the amount the courier must collect (the order total, set when the order is placed). */
  codAmountMinor: number | null
  /** Cash on delivery: the courier's settlement reference (borderou, payment order) recorded with the collection. */
  codReference: string | null
  paidAt: Date | null
  cancelledAt: Date | null
  cancelReason: string | null
  refundedAt: Date | null
  fgoInvoiceSeries: string | null
  fgoInvoiceNumber: string | null
  fgoInvoiceLink: string | null
  fgoStornoNumber: string | null
  ghlContactId: string | null
  ghlOpportunityId: string | null
  courier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  shippedAt: Date | null
  deliveredAt: Date | null
  /** Checkout recovery for an abandoned card order: whether a recovery email may be sent, and why. */
  recoveryStatus: RecoveryStatus | null
  recoveryReason: string | null
  /** Opaque token of the recovery link (it only restores the cart), and when it stops working. */
  recoveryToken: string | null
  recoveryExpiresAt: Date | null
  /** Validated campaign data from the checkout (landing, UTM). null = came through the main site. */
  attribution: Attribution | null
  /** After a withdrawal: the return was announced, then the product arrived back. */
  returnStatus: ReturnStatus | null
  returnRequestedAt: Date | null
  returnReceivedAt: Date | null
  kind: OrderKind
  /** Upsell orders: the paid order they were offered after. */
  parentOrderId: string | null
  /** Card orders: Stripe's customer and the card saved for the post-purchase offer (ids only, never card data). */
  stripeCustomerId: string | null
  stripePaymentMethodId: string | null
  /** Parent orders: the post-purchase offer's state and deadline. */
  upsellStatus: UpsellStatus | null
  upsellExpiresAt: Date | null
  /**
   * Business orders paid by cash on delivery or transfer: 'awaiting' until a person confirms them by phone, then
   * 'confirmed'. null for every other order (no confirmation needed). Preparation waits for it (state.ts canFulfil).
   */
  teamConfirmation: TeamConfirmation | null
  teamConfirmedAt: Date | null
  teamConfirmedBy: string | null
  /** Fulfillment portal: the parcel is packed (still 'processing'), and a problem reported by the warehouse. */
  preparedAt: Date | null
  fulfillmentIssue: string | null
  fulfillmentIssueAt: Date | null
  /**
   * Checkout risk (server/risk.ts): 'pending' while the order waits for a person's check ("Necesită verificare"),
   * 'cleared' once a person confirmed it, null for an order that was never flagged. Preparation waits for it, like
   * for the team's confirmation; payment and status are untouched. Admin only: never shown to the customer.
   */
  riskReview: RiskReview | null
  riskScore: number | null
  riskReasons: string[]
  riskReviewedAt: Date | null
  riskReviewedBy: string | null
  /** The personal voucher or reward this order used (server/vouchers.ts), null without one. */
  voucherId: string | null
  items: OrderItem[]
}

export type RiskReview = 'pending' | 'cleared'

export type TeamConfirmation = 'awaiting' | 'confirmed'

export type RecoveryStatus = 'eligible' | 'ineligible'

export const customerName = (c: Customer) => `${c.firstName} ${c.lastName}`.trim()
/** Name on the invoice: the company for PJ, the person for PF. */
export const billingName = (c: Customer) => (c.buyerType === 'pj' && c.company ? c.company : customerName(c))
export type OrderSite = 'ro' | 'net'

/** One line: Romanian addresses as couriers expect them; abroad with the region (if any) and the country's name. */
export const formatAddress = (a: Address, locale: 'ro' | 'en' = 'ro') =>
  !a.country || a.country === 'RO'
    ? `${a.address}, ${a.city}, ${locale === 'en' ? '' : 'jud. '}${a.county}${locale === 'en' ? ' County' : ''}, ${a.postalCode}${locale === 'en' ? ', Romania' : ''}`
    : [a.address, a.city, a.county, a.postalCode, countryName(a.country, locale)].filter(Boolean).join(', ')
