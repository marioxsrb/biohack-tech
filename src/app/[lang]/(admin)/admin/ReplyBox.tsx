import { REPLY_MAX, type ThreadKind } from '@/server/replies'
import { replyAction } from './actions'

/**
 * The box to answer the customer: the reply goes by email from contact@ (their answer comes back into this
 * conversation); without the customer's email only the phone is left.
 */
export function ReplyBox({ kind, id, email }: { kind: ThreadKind; id: string; email: string | null }) {
  if (!email) return <p className="mt-4 text-[13.5px] text-muted">Clientul nu a lăsat o adresă de email: răspunsul se dă la telefon.</p>
  return (
    <form action={replyAction} className="mt-4 space-y-2 rounded-[16px] bg-paper p-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <label className="block text-[13px] text-muted">
        Răspunde pe email la {email}
        <textarea
          name="body"
          required
          rows={5}
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
  )
}
