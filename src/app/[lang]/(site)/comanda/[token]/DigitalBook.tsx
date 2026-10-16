'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import cover from '@/assets/img/carte/coperta.png'
import { Arrow } from '@/components/ui/icons'
import type { PageDigital } from '@/server/digital/delivery'

const COPY = {
  ro: {
    ready: 'Cartea ta digitală este pregătită',
    readyText: ['Poți începe să citești chiar acum.', 'Cartea fizică va ajunge ulterior la tine.'],
    download: 'Descarcă versiunea PDF',
    linkNote: 'Linkul de pe această pagină se reînnoiește la fiecare deschidere. Ți l-am trimis și pe email.',
    confirming: 'Confirmăm plata. Cartea digitală va fi disponibilă în câteva momente.',
    slow: 'Confirmarea durează mai mult decât de obicei. Îți trimitem linkul pe email imediat ce plata este confirmată.',
    afterTransfer: 'Versiunea PDF îți vine pe email imediat ce primim transferul.',
    afterDelivery: 'Versiunea PDF îți vine pe email după ce primești coletul.',
    byEmail: 'Versiunea PDF îți vine pe email în scurt timp.',
    closed: 'Accesul la versiunea PDF nu mai este disponibil pentru această comandă.',
    title: 'Știu. Vreau. DE CE NU POT?',
    author: 'Diana L. Palotaș',
    digital: 'Cartea digitală',
  },
  en: {
    ready: 'Your digital book is ready',
    readyText: ['You can start reading right now.', 'The print book will reach you later.'],
    download: 'Download the PDF',
    linkNote: 'The link on this page is renewed each time you open it. We also emailed it to you.',
    confirming: 'We are confirming your payment. The digital book will be available in a few moments.',
    slow: 'The confirmation is taking longer than usual. We will email you the link as soon as the payment is confirmed.',
    afterTransfer: 'The PDF comes by email as soon as we receive your transfer.',
    afterDelivery: 'The PDF comes by email once you receive the parcel.',
    byEmail: 'The PDF comes by email shortly.',
    closed: 'Access to the PDF is no longer available for this order.',
    title: 'Știu. Vreau. DE CE NU POT?',
    author: 'Diana L. Palotaș',
    digital: 'Your digital book',
  },
}

/**
 * Re-renders the page (server state only, never a URL parameter) while Stripe's confirmation arrives: every 3 s for
 * half a minute, then every 10 s up to five minutes. The PDF section appears by itself once the webhook is in.
 */
function useAwaitConfirmation(active: boolean) {
  const router = useRouter()
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!active) return
    let n = 0
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      n++
      router.refresh()
      if (n === 10) setSlow(true)
      if (n < 37) timer = setTimeout(tick, n < 10 ? 3000 : 10_000)
    }
    timer = setTimeout(tick, 2500)
    return () => clearTimeout(timer)
  }, [active, router])
  return slow
}

/** The book's PDF on the order page: the download when access is granted, otherwise when it will come. */
export function DigitalBook({ state, locale }: { state: PageDigital; locale: 'ro' | 'en' }) {
  const t = COPY[locale]
  const slow = useAwaitConfirmation(state.state === 'confirming')

  if (state.state === 'ready') {
    return (
      <section aria-labelledby="digital-book" className="relative mt-8 overflow-hidden rounded-[24px] bg-ink text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(193,154,74,.28),transparent_60%)]" />
        <div className="relative grid items-center gap-7 p-8 sm:grid-cols-[140px_1fr] max-sm:p-6">
          <Image src={cover} alt={`${t.title}, ${t.author}`} width={140} className="w-[110px] rounded-[6px] shadow-[0_24px_48px_-12px_rgba(0,0,0,.6)] sm:w-[140px]" placeholder="blur" />
          <div>
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#d8b878] uppercase">{t.digital}</p>
            <h2 id="digital-book" className="mt-2 text-[clamp(24px,2.6vw,30px)] leading-tight tracking-[-0.02em] text-white">
              {t.ready}
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-white/80">
              {t.readyText[0]}
              <br />
              {t.readyText[1]}
            </p>
            <a href={state.url} rel="nofollow noopener" className="mt-6 inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-white px-6 text-[16px] font-semibold text-ink transition-transform hover:-translate-y-px">
              {t.download} <Arrow className="h-4 w-4 rotate-90" />
            </a>
            <p className="mt-4 text-[13px] text-white/55">{t.linkNote}</p>
          </div>
        </div>
      </section>
    )
  }

  const text =
    state.state === 'confirming' ? (slow ? t.slow : t.confirming) : state.state === 'after_transfer' ? t.afterTransfer : state.state === 'after_delivery' ? t.afterDelivery : state.state === 'by_email' ? t.byEmail : t.closed
  return (
    <section aria-live="polite" className="mt-6 flex items-center gap-5 rounded-[20px] bg-paper p-5 max-sm:items-start">
      <Image src={cover} alt="" width={56} className="w-[48px] flex-none rounded-[4px] shadow-[0_8px_18px_-8px_rgba(0,0,0,.45)]" placeholder="blur" />
      <div>
        <p className="text-[13px] font-semibold tracking-[0.12em] text-muted uppercase">{t.digital}</p>
        <p className="mt-1 flex items-center gap-3 text-[15.5px] leading-snug text-ink">
          {state.state === 'confirming' && !slow && <span aria-hidden className="spinner !border-ink/20 !border-t-ink" />}
          {text}
        </p>
      </div>
    </section>
  )
}
