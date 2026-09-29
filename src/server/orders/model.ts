/**
 * The canonical order. It exists in our database independently of Stripe, FGO or
 * GoHighLevel; those systems receive copies and references, never the other way round.
 *
 * Two separate state axes:
 *   OrderStatus   where the order is in its life (to prepare, shipped...)
 *   PaymentStatus what we know about the money
 */
import type { Attribution } from '@/lib/attribution'

export const ORDER_STATUS = {
  pending: 'pending', // created, waiting for payment
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
  failed: 'failed', // last card attempt failed; the customer can retry
  cancelled: 'cancelled', // the card payment was cancelled in Stripe before any money moved
  paid: 'paid',
  partiallyRefunded: 'partially_refunded',
  refunded: 'refunded',
} as const
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]

export const PAYMENT_METHOD = { card: 'card', bankTransfer: 'bank_transfer' } as const
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD]

export const INVOICE_STATUS = {
  none: 'none', // not due yet
  pending: 'pending', // queued for FGO
  issued: 'issued',
  failed: 'failed', // FGO refused or kept failing: needs a person
  manual: 'manual', // FGO not configured or manual policy: issue by hand
} as const
export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS]

export type ReturnStatus = 'requested' | 'received'

export type Address = { address: string; city: string; county: string; postalCode: string; country: 'RO' }

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
  lineTotalMinor: number
}

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
  currency: 'RON'
  subtotalMinor: number
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
  items: OrderItem[]
}

export type RecoveryStatus = 'eligible' | 'ineligible'

export const customerName = (c: Customer) => `${c.firstName} ${c.lastName}`.trim()
/** Name on the invoice: the company for PJ, the person for PF. */
export const billingName = (c: Customer) => (c.buyerType === 'pj' && c.company ? c.company : customerName(c))
export const formatAddress = (a: Address) => `${a.address}, ${a.city}, jud. ${a.county}, ${a.postalCode}`
