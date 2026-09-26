'use client'

import Link from 'next/link'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { cartStore } from '@/components/cart/cart-store'
import { Arrow, Check, Copy } from '@/components/ui/icons'
import type { BankDetails } from '@/config/bank'
import { site, terms } from '@/config/site'
import { DRAFT_KEY, TRANSFER_KEY } from '@/lib/checkout'
import { formatLei } from '@/lib/money'

type StoredOrder = {
  reference: string
  total: number
  email: string
  lineKeys: string[]
  lines: { name: string; variant?: string; quantity: number; total: number }[]
}

function parse(raw: string | null): StoredOrder | null {
  try {
    const o = JSON.parse(raw ?? 'null')
    return o && typeof o.reference === 'string' && /^BT-[A-Z0-9]{6}$/.test(o.reference) && Number.isInteger(o.total) && Array.isArray(o.lines) ? o : null
  } catch {
    return null
  }
}

// Re-parse only when the stored string changes, so the snapshot stays referentially stable.
let lastRaw: string | null = null
let lastOrder: StoredOrder | null = null
function snapshot() {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(TRANSFER_KEY)
  } catch {}
  if (raw !== lastRaw) {
    lastRaw = raw
    lastOrder = parse(raw)
  }
  return lastOrder
}

const useStoredOrder = () =>
  useSyncExternalStore(
    () => () => {},
    snapshot,
    () => undefined,
  )

export function TransferConfirmation({ bank }: { bank: BankDetails | null }) {
  const order = useStoredOrder()

  // The order is placed: take its lines out of the cart and forget the form draft.
  useEffect(() => {
    if (!order) return
    order.lineKeys.forEach((k) => cartStore.remove(k))
    try {
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {}
  }, [order])

  if (order === undefined) return <div className="min-h-[50vh]" aria-busy="true" />

  if (!order || !bank) {
    return (
      <>
        <h1 className="text-[36px] leading-tight tracking-[-0.035em] max-sm:text-[30px]">Nu găsim detaliile comenzii.</h1>
        <p className="sub mt-4">
          Datele pentru transfer apar aici imediat după ce plasezi comanda. Dacă ai plasat deja o comandă și ai închis pagina, scrie-ne la{' '}
          <a href={`mailto:${site.email}`} className="font-medium text-ink underline underline-offset-4">
            {site.email}
          </a>{' '}
          și îți trimitem datele din nou.
        </p>
        <Link href="/" className="tlink mt-8">
          Înapoi la magazin <Arrow />
        </Link>
      </>
    )
  }

  const rows: [string, string, boolean][] = [
    ['Beneficiar', bank.beneficiary, true],
    ['IBAN', bank.iban, true],
    ['Banca', bank.bank, false],
    ...(bank.swift ? [['SWIFT', bank.swift, true] as [string, string, boolean]] : []),
    ['Suma', formatLei(order.total), false],
    ['Detalii plată', `Comanda ${order.reference}`, true],
  ]

  return (
    <>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
        <Check className="h-6 w-6" />
      </span>
      <h1 className="mt-6 text-[36px] leading-tight tracking-[-0.035em] max-sm:text-[30px]">Comanda {order.reference} este înregistrată.</h1>
      <p className="sub mt-4">
        Mai ai un pas: transferul bancar. Comanda așteaptă plata și o pregătim imediat ce suma ajunge în cont.
      </p>

      <div className="mt-8 rounded-[20px] bg-paper p-6 max-sm:px-5">
        <h2 className="text-[19px] tracking-[-0.015em]">Datele pentru transfer</h2>
        <dl className="mt-4 divide-y divide-mist-2 border-y border-mist-2">
          {rows.map(([label, value, copy]) => (
            <div key={label} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 py-3 max-sm:grid-cols-[1fr_auto]">
              <dt className="text-[14.5px] text-muted max-sm:col-span-2">{label}</dt>
              <dd className={`text-[16px] font-medium break-words text-ink ${label === 'IBAN' ? 'font-mono text-[15px] tracking-[0.02em]' : ''}`}>{value}</dd>
              {copy ? <CopyButton value={label === 'IBAN' ? value.replace(/\s/g, '') : value} label={label} /> : <span />}
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[14.5px] leading-relaxed text-text">
          Scrie <strong className="font-semibold text-ink">{order.reference}</strong> la detaliile plății, ca să putem potrivi transferul cu comanda ta.
        </p>
      </div>

      <div className="mt-6 rounded-[20px] bg-paper p-6 max-sm:px-5">
        <h2 className="text-[19px] tracking-[-0.015em]">Ce ai comandat</h2>
        <ul className="mt-3 divide-y divide-mist-2">
          {order.lines.map((l) => (
            <li key={`${l.name}${l.variant}`} className="flex justify-between gap-4 py-2.5 text-[15px]">
              <span className="text-ink">
                {l.quantity} × {l.name}
                {l.variant && <span className="text-muted"> · {l.variant}</span>}
              </span>
              <span className="font-medium text-ink tabular-nums">{formatLei(l.total)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between border-t border-mist-2 pt-3 text-[16px] font-medium text-ink">
          <span>Total</span>
          <span className="tabular-nums">{formatLei(order.total)}</span>
        </p>
        <p className="mt-1 text-right text-[13px] text-muted">{terms.vat} · Livrare gratuită</p>
      </div>

      <ol className="mt-8 space-y-3 text-[15.5px] text-text">
        <li className="flex gap-3">
          <span className="font-semibold text-ink">1.</span> Faci transferul cu datele de mai sus.
        </li>
        <li className="flex gap-3">
          <span className="font-semibold text-ink">2.</span> Când plata ajunge în cont, pregătim coletul în {terms.processingDays}.
        </li>
        <li className="flex gap-3">
          <span className="font-semibold text-ink">3.</span> Curierul îl livrează în {terms.transitDays}.
        </li>
      </ol>
      <p className="mt-6 text-[15px] text-text">
        Ai o întrebare? Scrie-ne la{' '}
        <a href={`mailto:${site.email}?subject=${encodeURIComponent(`Comanda ${order.reference}`)}`} className="font-medium text-ink underline underline-offset-4">
          {site.email}
        </a>{' '}
        sau sună la{' '}
        <a href={site.phoneHref} className="font-medium whitespace-nowrap text-ink underline underline-offset-4">
          {site.phone}
        </a>
        .
      </p>
      <Link href="/" className="tlink mt-8">
        Înapoi la magazin <Arrow />
      </Link>
    </>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1800)
    return () => clearTimeout(t)
  }, [done])
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value).then(() => setDone(true), () => {})}
      className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-ink transition-colors hover:bg-mist max-sm:row-start-2 max-sm:col-start-2"
      aria-label={`Copiază ${label}`}
    >
      {done ? <Check className="h-4 w-4 text-cyan-700" /> : <Copy className="h-4 w-4" />}
      <span aria-live="polite">{done ? 'Copiat' : 'Copiază'}</span>
    </button>
  )
}
