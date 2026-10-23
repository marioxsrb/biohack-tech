import type { Metadata } from 'next'
import { connection } from 'next/server'
import Link from '@/components/ui/Link'
import { catalogProduct } from '@/content/catalog'
import { GIFT_PRODUCTS, VOUCHER_VALUE } from '@/config/vouchers'
import { site } from '@/config/site'
import { formatLei } from '@/lib/money'
import { AD_CONSENT_TEXT, accountEmail, reviewableOrders } from '@/server/account'
import { getDb } from '@/server/db'
import { rewardsFor } from '@/server/rewards'
import { vouchersFor, type Voucher } from '@/server/vouchers'
import { adConsentAction, chooseRewardAction } from './actions'

export const metadata: Metadata = { title: 'Contul tău Biohack Tech', robots: { index: false, follow: false } }

const day = (d: Date) => d.toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest', day: 'numeric', month: 'long', year: 'numeric' })
const name = (id: string | null) => (id ? (catalogProduct(id)?.name ?? id) : '')
const mask = (email: string) => email.replace(/^(.)[^@]*(@.*)$/, '$1•••$2')

const STATUS: Record<Voucher['status'], string> = { active: 'Disponibil', used: 'Folosit', expired: 'Expirat', revoked: 'Retras' }
const SOURCE: Record<string, string> = { review: 'Review video', referral: 'Recomandare', vip: 'Client VIP' }
const REVIEW: Record<string, string> = { received: 'Primit, în verificare', in_review: 'În verificare', approved: 'Aprobat', rejected: 'Respins: poți trimite altul' }

/**
 * The customer's vouchers, rewards and review videos, opened by the signed link from their own emails
 * (server/account.ts). Nothing here is reachable without that link; another address shows nothing.
 */
export default async function AccountPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection()
  const { token } = await params
  const result = String((await searchParams).r ?? '')
  const email = accountEmail(decodeURIComponent(token))
  if (!email) {
    return (
      <section className="pt-[calc(var(--nav-h)+56px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+28px)]">
        <div className="wrap max-w-[640px]">
          <h1 className="text-[clamp(28px,3.4vw,38px)] leading-tight tracking-[-0.035em]">Linkul a expirat.</h1>
          <p className="sub mt-4">
            Folosește linkul din cel mai recent email de la noi sau scrie-ne la{' '}
            <a href={`mailto:${site.email}`} className="font-medium text-ink underline underline-offset-4">
              {site.email}
            </a>
            .
          </p>
        </div>
      </section>
    )
  }
  const db = await getDb()
  const now = new Date()
  const [vouchers, rewards, orders] = await Promise.all([vouchersFor(db, email), rewardsFor(db, email), reviewableOrders(db, email)])
  const available = vouchers.filter((v) => v.status === 'active' && v.expiresAt > now)
  const past = vouchers.filter((v) => !available.includes(v))
  const t = encodeURIComponent(token)

  return (
    <section className="pt-[calc(var(--nav-h)+56px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+28px)]">
      <div className="wrap max-w-[860px]">
        <p className="text-[13px] font-medium tracking-[0.12em] text-muted uppercase">Contul tău Biohack Tech</p>
        <h1 className="mt-2 text-[clamp(30px,3.6vw,42px)] leading-tight tracking-[-0.035em]">Voucherele și recompensele tale</h1>
        <p className="sub mt-3">Pentru {mask(email)}. Fiecare voucher se folosește o singură dată, la produsul lui, cu această adresă de email.</p>
        {result === 'ales' && <p className="mt-6 rounded-[14px] bg-cyan-50 px-4 py-3 text-[15px] text-cyan-700">Alegerea ta a fost salvată. Codul apare mai jos.</p>}
        {result === 'acord' && <p className="mt-6 rounded-[14px] bg-cyan-50 px-4 py-3 text-[15px] text-cyan-700">Am salvat acordul. Video-ul este eligibil pentru recompensă.</p>}
        {result === 'retras' && <p className="mt-6 rounded-[14px] bg-cyan-50 px-4 py-3 text-[15px] text-cyan-700">Am înregistrat retragerea acordului. Scoatem video-ul din materialele noastre în cel mult 7 zile lucrătoare.</p>}
        {result === 'eroare' && <p className="mt-6 rounded-[14px] bg-paper px-4 py-3 text-[15px] text-ink">Modificarea a rămas nesalvată. Încearcă din nou sau scrie-ne.</p>}

        <h2 className="mt-12 text-[24px] tracking-[-0.02em]">Vouchere disponibile</h2>
        {available.length === 0 ? (
          <p className="mt-3 text-[15.5px] text-text">Voucherele noi apar aici imediat ce le primești.</p>
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {available.map((v) => (
              <li key={v.id} className="rounded-[20px] bg-paper p-6">
                <p className="text-[13px] font-medium tracking-[0.08em] text-muted uppercase">{v.kind === 'gift' ? 'Cadou' : 'Voucher'}</p>
                <p className="mt-2 text-[32px] leading-none font-semibold tracking-[-0.03em] text-ink">{v.kind === 'gift' ? name(v.productId) : formatLei(v.amountMinor ?? 0)}</p>
                <p className="mt-2 text-[15px] text-text">
                  {v.kind === 'gift' ? 'Produsul e gratuit. Plătești doar transportul.' : v.perPaidUnit ? `Pentru ${name(v.productId)}: la fiecare pereche plătită.` : `Pentru ${name(v.productId)}.`}
                </p>
                <p className="mt-4 font-mono text-[15px] tracking-[0.08em] text-ink">{v.code}</p>
                <p className="mt-1 text-[14px] text-muted">Valabil până la {day(v.expiresAt)}</p>
                <a href={`/api/cont/folosire?t=${t}&cod=${v.code}`} className="cta sm mt-5 inline-flex">
                  Folosește voucherul
                </a>
              </li>
            ))}
          </ul>
        )}

        <h2 id="recompense" className="mt-14 text-[24px] tracking-[-0.02em]">Recompense</h2>
        {rewards.length === 0 ? (
          <p className="mt-3 text-[15.5px] text-text">Recompensele apar aici după un review video aprobat, o recomandare sau statutul de client VIP.</p>
        ) : (
          <ul className="mt-5 grid gap-4">
            {rewards.map((r) => (
              <li key={r.id} className="rounded-[20px] bg-paper p-6">
                <p className="text-[13px] font-medium tracking-[0.08em] text-muted uppercase">{SOURCE[r.source] ?? r.source}</p>
                {r.status === 'available' ? (
                  <form action={chooseRewardAction} className="mt-3">
                    <input type="hidden" name="t" value={decodeURIComponent(token)} />
                    <input type="hidden" name="reward" value={r.id} />
                    <fieldset>
                      <legend className="text-[17px] font-semibold text-ink">Alege recompensa</legend>
                      <div className="mt-3 grid gap-2">
                        {GIFT_PRODUCTS.map((p) => (
                          <label key={p} className="flex items-center gap-3 rounded-[12px] bg-white px-4 py-3 text-[15px] text-ink">
                            <input type="radio" name="choice" value={`gift:${p}`} required /> Cadou: {name(p)} (plătești doar transportul)
                          </label>
                        ))}
                        {r.source !== 'review' &&
                          (Object.keys(VOUCHER_VALUE) as (keyof typeof VOUCHER_VALUE)[]).map((p) => (
                            <label key={p} className="flex items-center gap-3 rounded-[12px] bg-white px-4 py-3 text-[15px] text-ink">
                              <input type="radio" name="choice" value={`voucher:${p}`} required /> Voucher {formatLei(VOUCHER_VALUE[p])} pentru {name(p)}
                            </label>
                          ))}
                      </div>
                    </fieldset>
                    <button className="cta sm mt-4">Salvează alegerea</button>
                  </form>
                ) : (
                  <p className="mt-2 text-[15.5px] text-text">
                    {r.status === 'claimed' ? `Ai ales: ${r.choice === 'gift' ? `cadou ${name(r.productId)}` : `voucher pentru ${name(r.productId)}`}. Codul este la vouchere.` : r.status === 'pending' ? 'În așteptare.' : 'Expirată.'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {orders.length > 0 && (
          <>
            <h2 id="review" className="mt-14 text-[24px] tracking-[-0.02em]">Review video</h2>
            <ul className="mt-5 grid gap-3">
              {orders.map((o) => (
                <li key={o.id} className="rounded-[20px] bg-paper p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[16px] font-semibold text-ink">Comanda {o.orderNumber}</p>
                      <p className="text-[14px] text-muted">{o.products}</p>
                    </div>
                    {o.reviewStatus && o.reviewStatus !== 'rejected' ? (
                      <span className="text-[14.5px] text-text">{REVIEW[o.reviewStatus] ?? o.reviewStatus}</span>
                    ) : (
                      <Link href={`/cont/${t}/review/${o.id}`} className="btn-secondary sm">
                        {o.reviewStatus === 'rejected' ? 'Trimite alt video' : 'Trimite review-ul video'}
                      </Link>
                    )}
                  </div>
                  {o.reviewStatus && o.reviewStatus !== 'rejected' && !o.fileDeleted && (
                    <form action={adConsentAction} className="mt-4 border-t border-mist-2 pt-4 text-[14.5px] text-text">
                      <input type="hidden" name="t" value={decodeURIComponent(token)} />
                      <input type="hidden" name="order" value={o.id} />
                      {o.adConsent ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span>Acord pentru site, rețele sociale și reclame: dat.</span>
                          <button name="consent" value="nu" className="btn-secondary sm">
                            Retrag acordul
                          </button>
                        </div>
                      ) : o.consentWithdrawn ? (
                        <span>Acord retras. Video-ul iese din materialele noastre în cel mult 7 zile lucrătoare.</span>
                      ) : o.reviewStatus !== 'approved' ? (
                        <div className="grid gap-3">
                          <span>
                            Video-ul este privat. Pentru recompensă, dă acordul: {AD_CONSENT_TEXT}{' '}
                            <Link href="/conditii-review-video" className="font-medium text-ink underline underline-offset-4">
                              Condițiile review-ului video
                            </Link>
                          </span>
                          <button name="consent" value="da" className="btn-secondary sm justify-self-start">
                            Dau acordul
                          </button>
                        </div>
                      ) : (
                        <span>Video-ul este privat, doar pentru echipa noastră.</span>
                      )}
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {past.length > 0 && (
          <>
            <h2 className="mt-14 text-[20px] tracking-[-0.02em] text-text">Istoric vouchere</h2>
            <ul className="mt-4 divide-y divide-mist-2 rounded-[20px] bg-paper px-5">
              {past.map((v) => (
                <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-[14.5px]">
                  <span className="text-ink">
                    {v.kind === 'gift' ? `Cadou ${name(v.productId)}` : `${formatLei(v.amountMinor ?? 0)} pentru ${name(v.productId)}`} <span className="font-mono text-muted">{v.code}</span>
                  </span>
                  <span className="text-muted">
                    {v.status === 'active' && v.expiresAt <= now ? 'Expirat' : STATUS[v.status]}
                    {v.usedAt ? ` · ${day(v.usedAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
