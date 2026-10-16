import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { inbox } from '@/server/inbox'
import { syncInboxAction } from './actions'

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Whether customers' email answers are being read from contact@ (IMAP), and a button to read now. */
export async function InboxStatus() {
  if (!getConfig().email.imap) return <p className="mt-2 text-[13.5px] text-muted">Răspunsurile clienților pe email nu sunt citite încă (IMAP neconfigurat): le găsești în căsuța contact@.</p>
  const s = await inbox.state(await getDb())
  return (
    <form action={syncInboxAction} className="mt-2 flex flex-wrap items-center gap-3 text-[13.5px] text-muted">
      <span>
        Răspunsurile pe email ale clienților vin aici automat din contact@
        {s?.lastOkAt ? ` · citit ultima dată ${dt(s.lastOkAt)}` : ' · încă necitit'}
        {s?.lastError && <span className="font-medium text-red-deep"> · ultima încercare a eșuat ({s.lastError}); se reîncearcă singur</span>}
      </span>
      <button className="rounded-[8px] px-2 py-1 text-ink underline underline-offset-4 hover:bg-paper">Verifică acum</button>
    </form>
  )
}
