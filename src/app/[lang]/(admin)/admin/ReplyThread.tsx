import { REPLY_MAX, type Reply, type ThreadKind } from '@/server/replies'
import { replyAction } from './actions'

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const STATE: Record<Reply['status'], { label: string; tone: string }> = {
  pending: { label: 'se trimite', tone: 'text-[#8a5300]' },
  sent: { label: 'trimis', tone: 'text-cyan-700' },
  failed: { label: 'netrimis', tone: 'text-red-deep' },
}

/**
 * The team's replies to one conversation, and the box to write the next one. The reply goes by email from
 * contact@ (the customer answers there); without the customer's email only the phone is left.
 */
export function ReplyThread({ kind, id, email, replies }: { kind: ThreadKind; id: string; email: string | null; replies: Reply[] }) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      {replies.length > 0 && (
        <ul className="mb-4 space-y-3">
          {replies.map((r) => (
            <li key={r.id} className="rounded-[12px] bg-mist px-4 py-3">
              <p className="text-[12.5px] text-muted">
                Răspunsul echipei · {dt(r.createdAt)} · către {r.toEmail} · <span className={`font-medium ${STATE[r.status].tone}`}>{STATE[r.status].label}</span>
                {r.status === 'failed' && r.error && ` (${r.error})`}
              </p>
              <p className="mt-1 text-[14.5px] leading-relaxed whitespace-pre-wrap text-ink">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
      {email ? (
        <form action={replyAction} className="space-y-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <label className="block text-[13px] text-muted">
            Răspunde pe email la {email}
            <textarea
              name="body"
              required
              rows={4}
              maxLength={REPLY_MAX}
              placeholder="Scrie răspunsul. Salutul („Bună, …!”) și semnătura echipei se adaugă singure; mesajul clientului apare citat dedesubt."
              className="mt-1 block w-full rounded-[10px] border border-line bg-white px-3 py-2 text-[14.5px] text-ink"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-secondary sm">Trimite răspunsul</button>
            <label className="flex items-center gap-2 text-[13.5px] text-muted">
              <input type="checkbox" name="resolve" value="da" /> și marchează rezolvat
            </label>
          </div>
        </form>
      ) : (
        <p className="text-[13.5px] text-muted">Clientul nu a lăsat o adresă de email: răspunsul se dă la telefon.</p>
      )}
    </div>
  )
}
