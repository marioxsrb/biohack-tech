import { connection } from 'next/server'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { ADMIN_PRINCIPAL_ID, appDevices, appSessions } from '@/server/app/auth'
import { appPushTestAction, appSignOutAllAction } from '../actions'

const dt = (d: Date | string | null) => (d ? new Date(d).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

/**
 * The private iOS app "BiohackTech Sales" (read-only: sales, orders, stats, a KA-CHING on every payment). It signs in
 * with user "admin" and the admin password (ADMIN_PASSWORD), so there are no accounts to manage here: only the
 * iPhones, a test notification and a way to sign every phone out.
 */
export default async function AppPage({ searchParams }: PageProps<'/[lang]/admin/aplicatie'>) {
  await connection()
  const message = String((await searchParams).mesaj ?? '')
  const db = await getDb()
  const [devices, sessions] = await Promise.all([appDevices.forUser(db, ADMIN_PRINCIPAL_ID), appSessions.active(db)])
  const apns = getConfig().apns

  return (
    <>
      <h1 className="mt-2 text-[34px] tracking-[-0.03em]">Aplicația iOS</h1>
      <p className="mt-1 max-w-[720px] text-[15px] text-muted">
        BiohackTech Sales: vânzările, comenzile și statisticile pe iPhone, doar pentru citire, cu notificare (KA-CHING) la fiecare plată încasată. Se intră cu utilizatorul „admin” și parola Admin-ului; la schimbarea parolei în Vercel (ADMIN_PASSWORD), telefoanele se deconectează singure. Aplicația nu poate modifica nimic.
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

      <section className="mt-6 rounded-[16px] bg-paper p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">Telefoane</h2>
            <p className="mt-1 text-[14px] text-muted">{sessions === 1 ? '1 sesiune activă' : `${sessions} sesiuni active`}</p>
          </div>
          {sessions > 0 && (
            <form action={appSignOutAllAction}>
              <button className="btn-secondary sm">Deconectează toate telefoanele</button>
            </form>
          )}
        </div>
        <ul className="mt-3 space-y-1 text-[14px]">
          {devices.map((d) => (
            <li key={d.id as string} className="text-text">
              📱 {(d.name as string) || 'iPhone'} · {d.environment === 'production' ? 'TestFlight' : 'Xcode'} · {d.active ? 'activ' : 'oprit'} · văzut {dt(d.last_seen_at as string)}
            </li>
          ))}
          {!devices.length && <li className="text-muted">Niciun iPhone înregistrat încă.</li>}
        </ul>
      </section>
    </>
  )
}
