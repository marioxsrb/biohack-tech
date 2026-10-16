import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { blockFor, digitalEmailFor, RESEND_COOLDOWN_MINUTES } from '@/server/digital/delivery'
import { entitlements, type Entitlement } from '@/server/digital/entitlements'
import { hasBook } from '@/server/digital/rules'
import { customerName, PAYMENT_METHOD_LABEL, type Order } from '@/server/orders/model'
import { orders } from '@/server/orders/repository'
import { digitalAccessAction, digitalSendAction } from '../../actions'
import { ORDER_LABEL, PAYMENT_LABEL, tone } from '../../labels'
import { CopyDigitalLink } from './CopyDigitalLink'
import { dt, EMAIL_LABEL, EVENT_LABEL } from '../format'

/** What depends on the time of the request: the preview's expiry date and whether a resend needs confirming. */
function moment(c: ReturnType<typeof getConfig>, o: Order, e: Entitlement | null, now = Date.now()) {
  // The preview carries a placeholder: no real link is created to show it.
  const preview = digitalEmailFor(c, o, { url: '#previzualizare', expiresAt: new Date(now + 7 * 86_400_000) })
  const recent = !!e?.emailSentAt && now - e.emailSentAt.getTime() < RESEND_COOLDOWN_MINUTES * 60_000
  return { preview, recent }
}

/**
 * One order's PDF: its state, why it is blocked (when it is), the email as the customer gets it, the actions
 * (send, resend with confirmation, a fresh link, revoke/restore) and the full history of grants, emails and downloads.
 */
export default async function DigitalOrderPage({ params, searchParams }: PageProps<'/[lang]/admin/livrare-digitala/[id]'>) {
  await connection()
  const { id } = await params
  const message = String((await searchParams).mesaj ?? '')
  const c = getConfig()
  const db = await getDb()
  const o = await orders.byId(db, id)
  if (!o || !hasBook(o)) notFound()
  const e = await entitlements.byOrder(db, o.id)
  const history = await entitlements.events(db, o.id)
  const block = blockFor(o, e, c)
  const { preview, recent } = moment(c, o, e)
  const books = o.items.filter((i) => i.productId === 'carte-diana').reduce((n, i) => n + i.quantity, 0)

  return (
    <>
      <p className="mt-2 text-[14px]">
        <Link href="/admin/livrare-digitala" className="text-muted underline underline-offset-4">
          ← Livrare digitală
        </Link>
      </p>
      <h1 className="mt-2 text-[32px] tracking-[-0.03em]">
        {o.orderNumber} · {customerName(o.customer)}
      </h1>
      <p className="mt-1 text-[15px] text-muted">
        {o.email} · {PAYMENT_METHOD_LABEL[o.paymentMethod]} · {books} {books === 1 ? 'carte' : 'cărți'} ·{' '}
        <Link href={`/admin/orders/${o.id}`} className="underline underline-offset-4">
          comanda completă
        </Link>
      </p>
      {message && <p className="mt-4 rounded-[12px] bg-cyan-50 px-4 py-3 text-[14.5px] text-cyan-700">{message}</p>}

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        {(
          [
            ['Plată', <span key="p" className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium ${tone(o.paymentStatus)}`}>{PAYMENT_LABEL[o.paymentStatus]}</span>],
            ['Livrare fizică', <span key="s" className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium ${tone(o.status)}`}>{ORDER_LABEL[o.status]}</span>],
            ['Acces PDF', e ? (e.status === 'active' ? `Activ din ${dt(e.grantedAt)}` : `Revocat ${dt(e.revokedAt)}`) : 'Neacordat'],
            ['Email PDF', e ? `${EMAIL_LABEL[e.emailStatus]}${e.emailSentAt ? ` · ${dt(e.emailSentAt)}` : ''}` : '—'],
            ['Descărcări', e ? `${e.downloads}${e.lastDownloadAt ? ` · ultima ${dt(e.lastDownloadAt)}` : ''}` : '—'],
            ['Ultima încercare', dt(e?.lastAttemptAt ?? null)],
            ['Emailuri trimise', e ? String(e.emailsSent) : '0'],
            ['Ultima eroare', e?.lastError ?? '—'],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-[14px] bg-paper p-4">
            <p className="text-[12.5px] text-muted">{k}</p>
            <div className="mt-1 text-[14.5px] text-ink">{v}</div>
          </div>
        ))}
      </section>

      {block && (
        <p className="mt-5 rounded-[12px] bg-[#fdecec] px-4 py-3 text-[14.5px] text-red-deep">
          <strong className="font-semibold">Livrarea este blocată.</strong> {block.text}
        </p>
      )}

      <section className="mt-6 rounded-[16px] bg-paper p-5">
        <h2 className="text-[17px] font-semibold text-ink">Acțiuni</h2>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <form action={digitalSendAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={o.id} />
            {recent && (
              <label className="flex items-center gap-2 text-[14px] text-text">
                <input type="checkbox" name="confirm" value="da" className="h-4 w-4 accent-[var(--color-ink)]" /> Confirm retrimiterea
              </label>
            )}
            <button className="btn-secondary sm" disabled={!!block}>
              {e && e.emailsSent > 0 ? 'Retrimite emailul cu PDF-ul' : 'Trimite emailul cu PDF-ul'}
            </button>
          </form>
          {!block && <CopyDigitalLink orderId={o.id} />}
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Fiecare trimitere și fiecare link copiat se înregistrează în istoric. O retrimitere în primele {RESEND_COOLDOWN_MINUTES} minute cere confirmare. Linkurile expiră (pagina comenzii: 30 min; email și admin: 7 zile) și nu funcționează după o anulare, o rambursare sau o revocare.
        </p>
        {e && (
          <form action={digitalAccessAction} className="mt-4 flex flex-wrap items-end gap-3 border-t border-mist-2 pt-4">
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="access" value={e.status === 'active' ? 'revoke' : 'restore'} />
            <label className="min-w-[260px] flex-1 text-[13px] text-muted">
              Motiv
              <input name="reason" maxLength={200} className="mt-1 block w-full rounded-[10px] border border-line bg-white px-3 py-2 text-[14.5px] text-ink" />
            </label>
            <label className="flex items-center gap-2 text-[14px] text-text">
              <input type="checkbox" name="confirm" value="da" className="h-4 w-4 accent-[var(--color-ink)]" /> Confirm
            </label>
            <button className="btn-secondary sm">{e.status === 'active' ? 'Revocă accesul (toate linkurile)' : 'Redă accesul'}</button>
          </form>
        )}
      </section>

      <section className="mt-6 rounded-[16px] bg-paper p-5">
        <details>
          <summary className="cursor-pointer text-[17px] font-semibold text-ink">Previzualizare email: „{preview.subject}”</summary>
          <p className="mt-2 text-[13px] text-muted">Așa îl primește clientul. Butonul din previzualizare nu este un link real.</p>
          <iframe title="Previzualizare email" sandbox="" srcDoc={preview.html} className="mt-3 h-[820px] w-full rounded-[12px] border border-line bg-white" />
        </details>
      </section>

      <section className="mt-6 rounded-[16px] bg-paper p-5">
        <h2 className="text-[17px] font-semibold text-ink">Istoric</h2>
        <ul className="mt-3 divide-y divide-mist-2 text-[14px]">
          {history.map((h) => (
            <li key={h.id} className="flex flex-wrap gap-x-4 gap-y-1 py-2.5">
              <span className="w-[150px] text-muted tabular-nums">{dt(h.createdAt)}</span>
              <span className="font-medium text-ink">{EVENT_LABEL[h.type] ?? h.type}</span>
              <span className="text-muted">{h.actor}</span>
              <span className="min-w-0 flex-1 text-text">
                {Object.entries(h.details)
                  .filter(([k]) => k !== 'expiresAt')
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(' · ')}
              </span>
            </li>
          ))}
          {!history.length && <li className="py-3 text-muted">Nimic încă.</li>}
        </ul>
      </section>
    </>
  )
}
