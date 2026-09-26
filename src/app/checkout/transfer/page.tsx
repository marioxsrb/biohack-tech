import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getBankDetails } from '@/config/bank'
import { TransferConfirmation } from './TransferConfirmation'

export const metadata: Metadata = {
  title: 'Comandă înregistrată',
  robots: { index: false, follow: false },
}

/** Bank details are read on the server, from configuration, never from the browser. */
export default async function TransferPage() {
  await connection()
  const bank = getBankDetails()
  return (
    <section className="pt-[calc(var(--nav-h)+56px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+28px)]">
      <div className="wrap max-w-[760px]">
        <TransferConfirmation bank={bank} />
      </div>
    </section>
  )
}
