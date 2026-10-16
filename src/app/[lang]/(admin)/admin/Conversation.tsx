import type { Inbound } from '@/server/inbox'
import type { Reply } from '@/server/replies'

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const STATE: Record<Reply['status'], { label: string; tone: string }> = {
  pending: { label: 'se trimite', tone: 'text-[#8a5300]' },
  sent: { label: 'trimis', tone: 'text-cyan-700' },
  failed: { label: 'netrimis', tone: 'text-red-deep' },
}

type Item = { at: Date; who: 'customer' | 'team'; key: string; head: string; body: string; note?: React.ReactNode; unread?: boolean }

/**
 * One conversation, oldest first: the customer's first message and their email answers on the left, the team's
 * replies on the right (cyan). Unread answers are marked until the conversation is opened.
 */
export function Conversation({ first, replies, inbound }: { first: { name: string; at: Date; text: string; via: string }; replies: Reply[]; inbound: Inbound[] }) {
  const items: Item[] = [
    { at: first.at, who: 'customer' as const, key: 'first', head: `${first.name} · ${first.via}`, body: first.text },
    ...replies.map<Item>((r) => ({
      at: r.createdAt,
      who: 'team',
      key: r.id,
      head: `Echipa · către ${r.toEmail}`,
      body: r.body,
      note: (
        <span className={`font-medium ${STATE[r.status].tone}`}>
          {STATE[r.status].label}
          {r.status === 'failed' && r.error && ` (${r.error})`}
        </span>
      ),
    })),
    ...inbound.map<Item>((m) => ({
      at: m.receivedAt,
      who: 'customer',
      key: m.id,
      head: `${m.fromName || m.fromEmail} · email`,
      body: m.body,
      note: m.attachments ? <span>{m.attachments} atașament(e), în căsuța contact@</span> : undefined,
      unread: !m.readAt,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime())

  return (
    <ol className="space-y-3">
      {items.map((i) => (
        <li key={i.key} className={`flex ${i.who === 'team' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-[16px] px-4 py-3 ${i.who === 'team' ? 'rounded-br-[6px] bg-cyan-50' : 'rounded-bl-[6px] bg-white shadow-[inset_0_0_0_1px_var(--color-line)]'}`}>
            <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
              <span className="font-medium text-text">{i.head}</span>
              <span>{dt(i.at)}</span>
              {i.note}
              {i.unread && <span className="rounded-full bg-red px-2 py-0.5 text-[11.5px] font-semibold text-white">nou</span>}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap text-ink">{i.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
