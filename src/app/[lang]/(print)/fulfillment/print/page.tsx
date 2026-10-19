import type { Metadata } from 'next'
import { OrderDocuments } from '@/components/print/OrderDocuments'

export const metadata: Metadata = { title: 'Printare comenzi', robots: { index: false, follow: false } }

/** The same A4 documents as the admin's, for the warehouse: without order values (only the cash to collect). */
export default function FulfillmentPrintPage({ searchParams }: PageProps<'/[lang]/fulfillment/print'>) {
  return <OrderDocuments searchParams={searchParams} base="/fulfillment/print" restricted />
}
