import type { Metadata } from 'next'
import { OrderDocuments } from '@/components/print/OrderDocuments'

export const metadata: Metadata = { title: 'Printare comenzi', robots: { index: false, follow: false } }

/** Printable documents (A4) for the admin; the same documents serve the fulfillment portal (/fulfillment/print). */
export default function PrintPage({ searchParams }: PageProps<'/[lang]/admin/print'>) {
  return <OrderDocuments searchParams={searchParams} base="/admin/print" />
}
