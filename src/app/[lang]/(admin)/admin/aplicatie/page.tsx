import { connection } from 'next/server'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { APP_MAX_USERS, APP_PASSWORD_MIN, appDevices, appUsers } from '@/server/app/auth'
import { appPushTestAction, appUserActiveAction, appUserCreateAction, appUserPasswordAction } from '../actions'

const dt = (d: Date | string | null) => (d ? new Date(d).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const field = 'mt-1 block w-full rounded-[10px] border border-line bg-white px-3 py-2 text-[14.5px] text-ink'

/**
 * The private iOS app "BiohackTech Sales" (read-only: sales, orders, stats, a KA-CHING on every payment): its two
 * accounts, their iPhones, and a test notification. Passwords are set here and never shown again.
 */
export default async function AppPage({ searchParams }: PageProps<'/[lang]/admin/aplicatie'>) {
  await connection()
  const message = String((await searchParams).mesaj ?? '')
  const db = await getDb()
  const users = await appUsers.list(db)
  const devices = await Promise.all(users.map((u) => appDevices.forUser(db, u.id)))
  const apns = getConfig().apns
  const active = users.filter((u) => u.active).length

  return (
    <>
      <h1 className="mt-2 text-[34px] tracking-[-0.03em]">Aplicația iOS</h1>
      <p className="mt-1 max-w-[720px] text-[15px] text-muted">
        BiohackTech Sales: vânzările, comenzile și statisticile pe iPhone, doar pentru citire, cu notificare (KA-CHING) la fiecare plată încasată. Cel mult {APP_MAX_USERS} conturi; fiecare intră în aplicație cu adresa și parola de aici.
      </p>
      {message && <p className="mt-4 rounded-[12px] bg-cyan-50 px-4 py-3 text-[14.5px] text-cyan-700">{message}</p>}

      <section className="mt-6 rounded-[16px] bg-paper p-5">
        <h2 className="text-[17px] font-semibold text-ink">Notificări (APNs)</h2>
        <p className="mt-1 text-[14px] text-muted">
          {apns ? `Configurat pentru ${apns.bundleId} (cheia ${apns.keyId}).` : 'Neconfigurat: lipsesc APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID sau APNS_PRIVATE_KEY în Vercel. Aplicația merge, dar fără notificări.'}
        </p>
        {apns && (
          <form action={appPushTestAction} className="mt-3">
            <button className="btn-secondary sm">Trimite o notificare de test (KA-CHING)</button>
          </form>
        )}
      </section>

      <section className="mt-6 space-y-4">
        {users.map((u, i) => (
          <div key={u.id} className="rounded-[16px] bg-paper p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[16px] font-semibold text-ink">
                  {u.name} {!u.active && <span className="ml-2 rounded-full bg-mist px-2.5 py-0.5 text-[12.5px] font-medium text-muted">dezactivat</span>}
                </p>
                <p className="text-[14px] text-muted">
                  {u.email} · creat {dt(u.createdAt)} · ultima intrare {dt(u.lastLoginAt)}
                </p>
              </div>
              <form action={appUserActiveAction}>
                <input type="hidden" name="id" value={u.id} />
                <button name="active" value={u.active ? 'nu' : 'da'} className="btn-secondary sm">
                  {u.active ? 'Dezactivează' : 'Reactivează'}
                </button>
              </form>
            </div>
            <ul className="mt-3 space-y-1 text-[14px]">
              {devices[i].map((d) => (
                <li key={d.id as string} className="text-text">
                  📱 {(d.name as string) || 'iPhone'} · {d.environment === 'production' ? 'TestFlight' : 'Xcode'} · {d.active ? 'activ' : 'oprit'} · văzut {dt(d.last_seen_at as string)}
                </li>
              ))}
              {!devices[i].length && <li className="text-muted">Niciun iPhone înregistrat încă.</li>}
            </ul>
            <form action={appUserPasswordAction} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={u.id} />
              <label className="min-w-[240px] flex-1 text-[13px] text-muted">
                Parolă nouă (deconectează telefoanele contului)
                <input name="password" type="password" minLength={APP_PASSWORD_MIN} autoComplete="new-password" required className={field} />
              </label>
              <button className="btn-secondary sm">Schimbă parola</button>
            </form>
          </div>
        ))}
      </section>

      {active < APP_MAX_USERS && (
        <form action={appUserCreateAction} className="mt-6 grid gap-3 rounded-[16px] bg-paper p-5 sm:grid-cols-3">
          <h2 className="text-[17px] font-semibold text-ink sm:col-span-3">Cont nou</h2>
          <label className="text-[13px] text-muted">
            Nume
            <input name="name" required maxLength={80} className={field} />
          </label>
          <label className="text-[13px] text-muted">
            Email
            <input name="email" type="email" required maxLength={160} className={field} />
          </label>
          <label className="text-[13px] text-muted">
            Parolă (minim {APP_PASSWORD_MIN} caractere)
            <input name="password" type="password" required minLength={APP_PASSWORD_MIN} autoComplete="new-password" className={field} />
          </label>
          <div className="sm:col-span-3">
            <button className="btn-secondary sm">Creează contul</button>
          </div>
        </form>
      )}
    </>
  )
}
