import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { catalogProduct } from '@/content/catalog'
import { VOUCHER_VALUE } from '@/config/vouchers'
import { formatLei } from '@/lib/money'
import { getDb } from '@/server/db'
import { listRewards, listVideoReviews, usableInAds } from '@/server/rewards'
import { listVouchers, voucherHistory, type VoucherStatus } from '@/server/vouchers'
import { workflowsMode } from '@/server/workflows/engine'
import { accountLinkAction, deleteReviewVideoAction, issueVoucherAction, restoreVoucherAction, revokeVoucherAction, reviewVideoAction } from '../actions'

export const metadata: Metadata = { title: 'Vouchere și recompense' }

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const name = (id: string | null) => (id ? (catalogProduct(id)?.name ?? id) : '–')

const STATUS: Record<VoucherStatus, string> = { active: 'activ', used: 'folosit', expired: 'expirat', revoked: 'revocat' }
const EVENT: Record<string, string> = {
  issued: 'Emis',
  reused: 'Refolosit (era deja activ)',
  used: 'Folosit',
  released: 'Eliberat (comanda nu mai stă)',
  expired: 'Expirat',
  revoked: 'Revocat',
  restored: 'Reactivat',
  conflict: 'Conflict: plătit cu voucherul luat de altă comandă',
}
const TABS = ['active', 'used', 'expired', 'revoked'] as const

/**
 * Personal vouchers (Calm 640, Focus 325, Amber 30 lei per paid pair) and gifts, with their history; the rewards of
 * Review Video, Referral and VIP; the review videos to approve. Infrastructure: nothing here is issued by itself.
 */
export default async function VouchersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection()
  const sp = await searchParams
  const message = String(sp.mesaj ?? '').slice(0, 400)
  const status = (TABS as readonly string[]).includes(String(sp.status)) ? (String(sp.status) as VoucherStatus) : undefined
  const db = await getDb()
  const [list, rewards, videos] = await Promise.all([listVouchers(db, { status }), listRewards(db), listVideoReviews(db)])
  const history = new Map(await Promise.all(list.slice(0, 60).map(async (v) => [v.id, await voucherHistory(db, v.id)] as const)))

  return (
    <>
      <h1 className="mt-2 text-[34px] tracking-[-0.03em]">Vouchere și recompense</h1>
      <p className="mt-2 max-w-[60em] text-[14.5px] text-muted">
        Voucherul este personal: îl poate folosi doar adresa căreia i-a fost emis, o singură dată, doar la produsul lui, prin câmpul de cod din checkout. Valori: NEUROS Calm {formatLei(VOUCHER_VALUE['balance-wave'])}, NEUROS Focus{' '}
        {formatLei(VOUCHER_VALUE['brainlink-pro'])}, NEUROS Amber {formatLei(VOUCHER_VALUE['ochelari-biohack'])} pe fiecare pereche plătită (la 2+1: 60 lei). O comandă anulată, o plată cu cardul nefinalizată sau o rambursare integrală îl
        eliberează. Workflow-urile de email: {workflowsMode() === 'off' ? 'oprite' : 'simulare (nu se trimite nimic)'}.
      </p>

      {message && <p className="mt-4 rounded-[12px] bg-cyan-50 px-4 py-3 text-[14.5px] text-cyan-700">{message}</p>}

      <h2 className="mt-8 text-[22px] tracking-[-0.02em]">Emite manual</h2>
      <form action={issueVoucherAction} className="mt-3 flex flex-wrap items-end gap-3 rounded-[16px] bg-paper p-5 text-[14px]">
        <label className="grid gap-1">
          <span className="text-muted">Email client</span>
          <input name="email" type="email" required className="field" />
        </label>
        <label className="grid gap-1">
          <span className="text-muted">Produs</span>
          <select name="product" className="field">
            {Object.keys(VOUCHER_VALUE).map((id) => (
              <option key={id} value={id}>
                {name(id)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="confirm" value="da" required className="h-4 w-4" /> Confirm emiterea
        </label>
        <button className="btn-secondary sm">Emite voucherul</button>
      </form>

      <form action={accountLinkAction} className="mt-3 flex flex-wrap items-end gap-3 rounded-[16px] bg-paper p-5 text-[14px]">
        <label className="grid gap-1">
          <span className="text-muted">Linkul de cont al unui client (vouchere, recompense, review video)</span>
          <input name="email" type="email" required className="field" />
        </label>
        <button className="btn-secondary sm">Generează linkul</button>
      </form>

      <nav aria-label="Filtre" className="mt-8 flex flex-wrap gap-2">
        <Link href="/admin/vouchere" aria-current={!status ? 'page' : undefined} className={`rounded-full px-3.5 py-1.5 text-[14px] ${!status ? 'bg-ink text-white' : 'bg-paper text-ink hover:bg-mist'}`}>
          Toate
        </Link>
        {TABS.map((t) => (
          <Link key={t} href={`/admin/vouchere?status=${t}`} aria-current={status === t ? 'page' : undefined} className={`rounded-full px-3.5 py-1.5 text-[14px] ${status === t ? 'bg-ink text-white' : 'bg-paper text-ink hover:bg-mist'}`}>
            {STATUS[t]}
          </Link>
        ))}
      </nav>
      <ul className="mt-4 space-y-3">
        {list.map((v) => (
          <li key={v.id} className="rounded-[16px] bg-paper p-5 text-[14.5px]">
            <p className="text-[17px] font-semibold tracking-[0.04em] text-ink">
              {v.code}{' '}
              <span className="ml-1 text-[14px] font-normal tracking-normal text-muted">
                · {v.kind === 'gift' ? `cadou ${name(v.productId)}` : `${name(v.productId)} ${formatLei(v.amountMinor ?? 0)}${v.perPaidUnit ? ' / pereche plătită' : ''}`} · {STATUS[v.status]}
              </span>
            </p>
            <p className="mt-1 text-[13.5px] text-muted">
              {v.email} · sursa {v.source} · emis {dt(v.issuedAt)} · expiră {dt(v.expiresAt)}
              {v.orderNumber && (
                <>
                  {' '}
                  · comanda{' '}
                  <Link href={`/admin/orders/${v.orderId}`} className="underline underline-offset-4">
                    {v.orderNumber}
                  </Link>
                </>
              )}
              {v.revokeReason && ` · motiv: ${v.revokeReason}`}
            </p>
            <ul className="mt-2 text-[13px] text-muted">
              {(history.get(v.id) ?? []).map((e, i) => (
                <li key={i}>
                  {dt(e.createdAt)} · {EVENT[e.type] ?? e.type} · {e.actor}
                </li>
              ))}
            </ul>
            {(v.status === 'active' || v.status === 'expired') && (
              <form action={revokeVoucherAction} className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px]">
                <input type="hidden" name="id" value={v.id} />
                <input name="reason" placeholder="Motivul revocării" required minLength={3} maxLength={300} className="field max-w-[22em]" />
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="confirm" value="da" required className="h-4 w-4" /> Confirm
                </label>
                <button className="btn-secondary sm">Revocă</button>
              </form>
            )}
            {(v.status === 'expired' || v.status === 'revoked') && (
              <form action={restoreVoucherAction} className="mt-2 flex flex-wrap items-center gap-2 text-[13.5px]">
                <input type="hidden" name="id" value={v.id} />
                <input name="days" type="number" min={1} max={90} defaultValue={7} className="field w-[6em]" aria-label="Zile" />
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="confirm" value="da" required className="h-4 w-4" /> Confirm
                </label>
                <button className="btn-secondary sm">Reactivează</button>
              </form>
            )}
          </li>
        ))}
        {!list.length && <li className="rounded-[16px] bg-paper px-5 py-10 text-center text-muted">Niciun voucher.</li>}
      </ul>

      <h2 className="mt-10 text-[22px] tracking-[-0.02em]">Recompense (Review Video, Referral, VIP)</h2>
      <ul className="mt-4 space-y-2">
        {rewards.map((r) => (
          <li key={r.id} className="rounded-[16px] bg-paper p-4 text-[14px]">
            <span className="font-semibold text-ink">{r.source}</span> · {r.email} · {r.status}
            {r.choice && ` · ${r.choice === 'gift' ? 'cadou' : 'voucher'} ${name(r.productId)}`}
            {r.code && ` · ${r.code} (${r.voucherStatus})`} · {dt(r.createdAt)}
          </li>
        ))}
        {!rewards.length && <li className="rounded-[16px] bg-paper px-5 py-8 text-center text-muted">Nicio recompensă.</li>}
      </ul>

      <h2 className="mt-10 text-[22px] tracking-[-0.02em]">Review-uri video</h2>
      <ul className="mt-4 space-y-2">
        {videos.map((r) => (
          <li key={r.id as string} className="rounded-[16px] bg-paper p-4 text-[14px]">
            <span className="font-semibold text-ink">{r.order_number as string}</span> · {r.email as string} · {r.status as string} · rating {(r.rating as number | null) ?? '–'} ·{' '}
            {usableInAds(r) ? (
              <span className="font-semibold text-cyan-700">poate fi folosit în reclame (acord {r.ad_consent_version as string}, {dt(new Date(r.ad_consent_at as string))})</span>
            ) : (
              <span className="font-semibold text-ink">
                NU se folosește în reclame
                {r.ad_consent_withdrawn_at ? ` (acord retras ${dt(new Date(r.ad_consent_withdrawn_at as string))})` : r.ad_consent ? ' până la aprobare' : ' (fără acord: fără recompensă)'}
              </span>
            )}
            {r.file_deleted_at ? (
              <span className="text-muted"> · fișier șters {dt(new Date(r.file_deleted_at as string))}</span>
            ) : (
              <>
                {' · '}
                <a href={`/api/admin/review-video/${r.id as string}`} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  Vezi video-ul (link 10 min)
                </a>
                <form action={deleteReviewVideoAction} className="inline">
                  <input type="hidden" name="id" value={r.id as string} />
                  {' · '}
                  <button className="underline underline-offset-4">Șterge fișierul (la cererea clientului)</button>
                </form>
              </>
            )}
            {r.reviewed_at ? <span className="text-muted"> · verificat {new Date(r.reviewed_at as string).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })} de {r.reviewed_by as string}</span> : null}
            {r.status !== 'approved' && (
              <form action={reviewVideoAction} className="mt-2 flex flex-wrap items-center gap-2 text-[13.5px]">
                <input type="hidden" name="id" value={r.id as string} />
                <input name="reason" placeholder="Motiv (la respingere)" maxLength={300} className="field max-w-[22em]" />
                <button name="to" value="approved" className="btn-secondary sm">
                  {r.ad_consent ? 'Aprobă (recompensa devine disponibilă)' : 'Aprobă (fără recompensă: lipsește acordul)'}
                </button>
                <button name="to" value="rejected" className="btn-secondary sm">
                  Respinge
                </button>
              </form>
            )}
          </li>
        ))}
        {!videos.length && <li className="rounded-[16px] bg-paper px-5 py-8 text-center text-muted">Niciun review video.</li>}
      </ul>
    </>
  )
}
