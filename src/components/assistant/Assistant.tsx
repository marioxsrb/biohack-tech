'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cartStore } from '@/components/cart/cart-store'
import { useCart } from '@/components/cart/CartProvider'
import { Thumb } from '@/components/cart/Thumb'
import { useGate } from '@/components/gate/Gate'
import { Arrow, Check, Close } from '@/components/ui/icons'
import { getProduct, type ProductId } from '@/content/catalog'
import { useLocale } from '@/i18n/LocaleProvider'
import { isChatSound, newAudioContext, playChatSound, type ChatSound } from '@/lib/chat-sounds'

/**
 * The website assistant: a bubble at the bottom right that opens a chat (full screen on phones). Answers stream
 * from /api/assistant; product cards, add-to-cart proposals, order details and the cancellation button are drawn
 * from the server's tool results. Nothing is bought or cancelled without the visitor's own click, and the cart is
 * the site's own cart. The conversation lives in this tab only (sessionStorage) and follows the visitor between
 * pages; it never reaches the server's database.
 */

const STORE_KEY = 'bt-assistant-v1'
const TEASER_KEY = 'bt-chat-teaser'
const TEASER_START = 'bt-chat-start'
/** The greeting bubble 30 seconds into the visit (business decision 16.10.2026). */
const TEASER_AFTER_MS = 30_000
const HIDDEN = /^(?:\/en)?\/(?:admin|fulfillment|prezentare)(?:\/|$)/

const COPY = {
  ro: {
    open: 'Deschide asistentul',
    close: 'Închide asistentul',
    title: 'Asistent Biohack Tech',
    subtitle: 'Asistent automat',
    hello: 'Bună! Te ajut să alegi produsul potrivit, cu întrebări despre comandă, livrare sau retur.',
    placeholder: 'Scrie un mesaj…',
    send: 'Trimite',
    reset: 'Conversație nouă',
    suggestions: ['Ce produs mi se potrivește?', 'Care este diferența dintre Calm și Focus?', 'Unde este comanda mea?', 'Cum funcționează retururile?', 'Vreau să vorbesc cu cineva.'],
    error: 'Nu am putut răspunde acum.',
    retry: 'Încearcă din nou',
    busy: 'Ai trimis multe mesaje într-un timp scurt. Încearcă peste câteva minute.',
    view: 'Vezi produsul',
    add: 'Adaugă în coș',
    added: 'Adăugat în coș',
    notNow: 'Nu acum',
    chooseFrame: 'Alege rama:',
    seePrice: 'Vezi prețul și oferta',
    soldOut: 'Stoc epuizat',
    cart: 'Vezi coșul',
    checkout: 'Finalizează comanda',
    total: 'Total',
    verified: 'Comandă verificată',
    status: 'Stare',
    payment: 'Plată',
    awb: 'AWB',
    track: 'Urmărește coletul',
    cancelAsk: 'Anulezi această comandă?',
    cancelYes: 'Da, anulează comanda',
    cancelNo: 'Nu',
    cancelled: (n: string) => `Comanda ${n} a fost anulată. Primești confirmarea pe email.`,
    cancelFail: 'Anularea nu a reușit.',
    request: 'Cerere trimisă echipei',
    disclaimer: 'Asistent automat. Nu introduce aici date de card.',
    teaserFrom: 'Asistent Biohack Tech',
    teaserNow: 'acum',
    teaserText: 'Bună! 👋 Te pot ajuta să alegi dispozitivul potrivit pentru tine?',
    teaserReplies: ['Da, ajută-mă să aleg', 'Am o întrebare'],
    teaserClose: 'Închide mesajul',
  },
  en: {
    open: 'Open the assistant',
    close: 'Close the assistant',
    title: 'Biohack Tech assistant',
    subtitle: 'Automated assistant',
    hello: 'Hi! I can help you choose the right product, and with questions about orders, delivery or returns.',
    placeholder: 'Write a message…',
    send: 'Send',
    reset: 'New conversation',
    suggestions: ['Which product is right for me?', 'What is the difference between Calm and Focus?', 'Where is my order?', 'How do returns work?', 'I want to talk to someone.'],
    error: 'I could not answer right now.',
    retry: 'Try again',
    busy: 'Too many messages in a short time. Please try again in a few minutes.',
    view: 'View product',
    add: 'Add to cart',
    added: 'Added to cart',
    notNow: 'Not now',
    chooseFrame: 'Choose the frame:',
    seePrice: 'See price and offer',
    soldOut: 'Sold out',
    cart: 'View cart',
    checkout: 'Checkout',
    total: 'Total',
    verified: 'Order verified',
    status: 'Status',
    payment: 'Payment',
    awb: 'Tracking no.',
    track: 'Track parcel',
    cancelAsk: 'Cancel this order?',
    cancelYes: 'Yes, cancel the order',
    cancelNo: 'No',
    cancelled: (n: string) => `Order ${n} has been cancelled. You will get a confirmation email.`,
    cancelFail: 'The cancellation did not go through.',
    request: 'Request sent to the team',
    disclaimer: 'Automated assistant. Do not enter card details here.',
    teaserFrom: 'Biohack Tech assistant',
    teaserNow: 'now',
    teaserText: 'Hi! 👋 Can I help you find the right device for you?',
    teaserReplies: ['Yes, help me choose', 'I have a question'],
    teaserClose: 'Close message',
  },
}
type Copy = (typeof COPY)['ro']

/** The visitor's cart, page and language go with every message (read when it is sent). */
const TRANSPORT = new DefaultChatTransport({
  api: '/api/assistant',
  prepareSendMessagesRequest: ({ messages }) => ({
    body: {
      messages,
      cart: cartStore.getSnapshot().map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
      page: window.location.pathname,
      locale: document.documentElement.lang === 'en' ? 'en' : 'ro',
      // The currency the visitor sees (the server keeps lei for Romanian pages whatever this says).
      currency: /(?:^|; )bt_cur=USD/.test(document.cookie) ? 'USD' : 'EUR',
    },
  }),
})

type Saved = { messages: UIMessage[]; open: boolean; done: Record<string, string> }
function load(): Saved {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? 'null') as Saved | null
    if (v && Array.isArray(v.messages)) return { messages: v.messages.slice(-40), open: !!v.open, done: v.done ?? {} }
  } catch {}
  return { messages: [], open: false, done: {} }
}
function save(s: Saved) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ ...s, messages: s.messages.slice(-40) }))
  } catch {}
}

export function Assistant() {
  const pathname = usePathname()
  const [enabled, setEnabled] = useState(false)
  const [initial, setInitial] = useState<Saved | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(window.__BT_STORE__?.assistant !== false)
    setInitial(load())
  }, [])

  if (!enabled || !initial || HIDDEN.test(pathname)) return null
  return <AssistantChat initial={initial} />
}

function AssistantChat({ initial }: { initial: Saved }) {
  const locale = useLocale()
  const t = COPY[locale]
  const pathname = usePathname()
  const [open, setOpen] = useState(initial.open)
  const [input, setInput] = useState('')
  const [done, setDone] = useState<Record<string, string>>(initial.done)
  const [offset, setOffset] = useState(0)
  const [consentShown, setConsentShown] = useState(false)
  // The greeting bubble: 30 seconds into the visit, once per browser session, until opened or closed.
  const [teaser, setTeaser] = useState<'hidden' | 'new' | 'shown'>('hidden')
  // Phones: the panel follows the visible part of the screen, so the on-screen keyboard never covers the input.
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  const { messages, sendMessage, status, error, regenerate, setMessages, stop, clearError } = useChat({ messages: initial.messages, transport: TRANSPORT })
  const busy = status === 'submitted' || status === 'streaming'

  // The conversation follows the visitor between pages and reloads (this tab only).
  useEffect(() => {
    if (status === 'ready' || status === 'error') save({ messages, open, done })
  }, [messages, status, open, done])

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, status, open])

  // Above the sticky buy bars of product pages and landings, and out of the way of the cookie banner on phones.
  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      let h = 0
      document.querySelectorAll<HTMLElement>('[data-sticky-bar]').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.height && r.top < window.innerHeight - 4) h = Math.max(h, window.innerHeight - r.top)
      })
      setOffset(h)
      // The cookie banner hides the bubble only where it covers it (phones: full width at the bottom). On wider
      // screens it sits at the bottom left, so a first visit (banner still open) gets the greeting too.
      const banner = document.querySelector('.consent-in')?.getBoundingClientRect()
      setConsentShown(!!banner && banner.height > 0 && banner.right > window.innerWidth - 400)
    }
    const schedule = () => (raf ||= requestAnimationFrame(measure))
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const timer = setInterval(schedule, 1500)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      clearInterval(timer)
      cancelAnimationFrame(raf)
    }
  }, [pathname])

  // Open: focus the input, Escape closes, the page behind does not scroll on phones.
  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => inputRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        launcherRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const phone = window.matchMedia('(max-width: 639px)').matches
    const vv = window.visualViewport
    const fit = () => vv && setViewport({ height: vv.height, top: vv.offsetTop })
    if (phone && vv) {
      fit()
      vv.addEventListener('resize', fit)
      vv.addEventListener('scroll', fit)
    }
    const html = document.documentElement
    const before = html.style.overflow
    if (phone) html.style.overflow = 'hidden'
    return () => {
      clearTimeout(id)
      document.removeEventListener('keydown', onKey)
      if (phone) html.style.overflow = before
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
      setViewport(null)
    }
  }, [open])

  useEffect(() => {
    if (open || messages.length) return
    let state: string | null = null
    let start = Date.now()
    try {
      state = sessionStorage.getItem(TEASER_KEY)
      start = Number(sessionStorage.getItem(TEASER_START) ?? 0) || Date.now()
      sessionStorage.setItem(TEASER_START, String(start))
    } catch {}
    if (state === 'closed') return
    // Already greeted on an earlier page of this visit: the bubble is simply there (no sound, no entrance).
    if (state === 'shown') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTeaser('shown')
      return
    }
    const timer = setTimeout(() => {
      setTeaser('new')
      try {
        sessionStorage.setItem(TEASER_KEY, 'shown')
      } catch {}
    }, Math.max(0, start + TEASER_AFTER_MS - Date.now()))
    return () => clearTimeout(timer)
  }, [open, messages.length])

  const closeTeaser = () => {
    setTeaser('hidden')
    try {
      sessionStorage.setItem(TEASER_KEY, 'closed')
    } catch {}
  }

  const send = useCallback(
    (text: string) => {
      const v = text.trim().slice(0, 1500)
      if (!v || busy) return
      if (error) clearError()
      void sendMessage({ text: v })
      setInput('')
    },
    [busy, error, clearError, sendMessage],
  )

  const mark = useCallback((key: string, value: string) => setDone((d) => ({ ...d, [key]: value })), [])
  const reset = () => {
    stop()
    setMessages([])
    setDone({})
    clearError()
    save({ messages: [], open, done: {} })
  }

  const busyError = error?.message?.includes('RATE_LIMIT')
  const lastIsUser = messages[messages.length - 1]?.role === 'user'
  const waiting = status === 'submitted' || (status === 'streaming' && lastIsUser)

  return (
    <>
      {!open && teaser !== 'hidden' && !consentShown && (
        <Teaser
          t={t}
          fresh={teaser === 'new'}
          bottom={`calc(${offset ? offset + 12 : 20}px + 68px + env(safe-area-inset-bottom, 0px))`}
          onOpen={(text) => {
            closeTeaser()
            setOpen(true)
            if (text) send(text)
          }}
          onClose={closeTeaser}
        />
      )}
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => {
            if (teaser !== 'hidden') closeTeaser()
            setOpen(true)
          }}
          aria-label={t.open}
          aria-expanded={false}
          style={{ bottom: `calc(${offset ? offset + 12 : 20}px + env(safe-area-inset-bottom, 0px))` }}
          className={`assistant-launcher ${teaser !== 'hidden' ? 'assistant-attract' : ''} fixed right-4 z-[230] flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_14px_34px_-12px_rgba(8,17,19,.55),0_0_0_1px_rgba(255,255,255,.08)] transition-[transform,bottom,opacity] duration-300 ease-[var(--ease-brand)] hover:scale-[1.05] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan-600 sm:right-5 print:hidden ${consentShown ? 'max-sm:pointer-events-none max-sm:opacity-0' : ''}`}
        >
          <ChatIcon />
          <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-ink bg-cyan-400" aria-hidden />
        </button>
      )}
      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          style={viewport ? { height: viewport.height, top: viewport.top, bottom: 'auto' } : undefined}
          className="assistant-panel fixed z-[270] flex flex-col overflow-hidden bg-mist shadow-[0_30px_80px_-24px_rgba(8,17,19,.45),0_0_0_1px_rgba(8,17,19,.08)] max-sm:inset-0 max-sm:h-dvh sm:right-5 sm:bottom-5 sm:h-[min(680px,calc(100dvh_-_40px))] sm:w-[400px] sm:rounded-[24px] print:hidden"
        >
          <header className="flex items-center gap-3 border-b border-line bg-paper px-4 py-3 pt-[max(12px,env(safe-area-inset-top))]">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ink text-white">
              <ChatIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate text-[15.5px] font-semibold text-ink">
                {t.title}
              </h2>
              <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <span className="h-2 w-2 rounded-full bg-[#22a06b]" aria-hidden />
                {t.subtitle}
              </p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={reset} aria-label={t.reset} title={t.reset} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-[18px] w-[18px]">
                  <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" />
                  <path d="M4 4v4.5h4.5" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setTimeout(() => launcherRef.current?.focus(), 0)
              }}
              aria-label={t.close}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-mist"
            >
              <Close className="h-5 w-5" />
            </button>
          </header>

          <div ref={listRef} className="assistant-scroll flex-1 space-y-3 overflow-y-auto overscroll-contain px-3.5 py-4" aria-live="polite" aria-busy={busy}>
            <Bubble role="assistant">{t.hello}</Bubble>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {t.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line bg-paper px-3.5 py-2 text-left text-[13.5px] text-ink transition-colors hover:border-ink">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m) => (
              <MessageView key={m.id} m={m} t={t} done={done} mark={mark} />
            ))}
            {waiting && <Typing />}
            {error && (
              <div className="rounded-[14px] bg-paper px-3.5 py-3 text-[14px] text-text">
                {busyError ? t.busy : t.error}{' '}
                {!busyError && (
                  <button type="button" onClick={() => void regenerate()} className="font-medium text-ink underline underline-offset-4">
                    {t.retry}
                  </button>
                )}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="border-t border-line bg-paper px-3 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor={`${titleId}-input`}>
                {t.placeholder}
              </label>
              <textarea
                id={`${titleId}-input`}
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                rows={1}
                maxLength={1500}
                placeholder={t.placeholder}
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-[22px] border border-line bg-mist px-4 py-[11px] text-[16px] leading-snug text-ink outline-none placeholder:text-faint focus:border-ink sm:text-[15px]"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                aria-label={t.send}
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:opacity-35"
              >
                <Arrow className="h-5 w-5 -rotate-90" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[11.5px] text-faint">{t.disclaimer}</p>
          </form>
        </section>
      )}
    </>
  )
}

function ChatIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z" />
      <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth={2.4} />
    </svg>
  )
}

function Typing() {
  return (
    <div className="flex w-fit items-center gap-1 rounded-[18px] rounded-bl-[6px] bg-paper px-4 py-3.5" aria-label="…">
      {[0, 1, 2].map((i) => (
        <span key={i} className="assistant-dot h-2 w-2 rounded-full bg-faint" style={{ animationDelay: `${i * 0.16}s` }} />
      ))}
    </div>
  )
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: ReactNode }) {
  return role === 'user' ? (
    <div className="ml-auto w-fit max-w-[85%] rounded-[18px] rounded-br-[6px] bg-ink px-3.5 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap text-white">{children}</div>
  ) : (
    <div className="w-fit max-w-[90%] rounded-[18px] rounded-bl-[6px] bg-paper px-3.5 py-2.5 text-[14.5px] leading-relaxed text-text">{children}</div>
  )
}

type Part = { type: string; text?: string; state?: string; toolCallId?: string; output?: unknown; input?: unknown }

function MessageView({ m, t, done, mark }: { m: UIMessage; t: Copy; done: Record<string, string>; mark: (k: string, v: string) => void }) {
  return (
    <>
      {(m.parts as Part[]).map((p, i) => {
        if (p.type === 'text') return p.text?.trim() ? <Bubble key={i} role={m.role === 'user' ? 'user' : 'assistant'}>{m.role === 'user' ? p.text : <RichText text={p.text} />}</Bubble> : null
        if (p.type.startsWith('tool-') && p.state === 'output-available' && p.output) return <ToolView key={i} name={p.type.slice(5)} id={p.toolCallId ?? String(i)} output={p.output as Record<string, unknown>} t={t} done={done} mark={mark} />
        return null
      })}
    </>
  )
}

/** The model's text: paragraphs, "- " lists, **bold** and links (site paths and https), as React elements only. */
function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        const list = lines.every((l) => /^\s*(?:[-•*]|\d+\.)\s+/.test(l))
        return list ? (
          <ul key={i} className={`list-disc space-y-0.5 pl-5 ${i ? 'mt-2' : ''}`}>
            {lines.map((l, j) => (
              <li key={j}>{inline(l.replace(/^\s*(?:[-•*]|\d+\.)\s+/, ''))}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className={i ? 'mt-2' : ''}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </span>
            ))}
          </p>
        )
      })}
    </>
  )
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = []
  // A site path is "/x", never "//host" (which a browser would open as another site).
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:https:\/\/|\/(?![/\\]))[^\s)]+)\)|(https:\/\/[^\s)]+[^\s).,!?])/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    if (m[1]) out.push(<b key={m.index} className="font-semibold text-ink">{m[1]}</b>)
    else {
      const href = m[3] ?? m[4]
      const label = m[2] ?? m[4]
      const own = /^\/(?![/\\])/.test(href) || /^https:\/\/(?:[\w-]+\.)?biohack-tech\.(?:ro|net)(?:\/|$)/.test(href)
      out.push(
        <a key={m.index} href={href} {...(!own && { target: '_blank', rel: 'noopener noreferrer' })} className="font-medium text-ink underline underline-offset-4">
          {label}
        </a>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}

function Btn({ children, onClick, primary, href }: { children: ReactNode; onClick?: () => void; primary?: boolean; href?: string }) {
  const cls = `inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors ${primary ? 'bg-ink text-white hover:bg-[#1c2a2f]' : 'border border-line bg-paper text-ink hover:border-ink'}`
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  )
}

function SmallBtn({ children, onClick, primary, href }: { children: ReactNode; onClick?: () => void; primary?: boolean; href?: string }) {
  const cls = `inline-flex min-h-9 items-center justify-center rounded-full px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors ${primary ? 'bg-ink text-white hover:bg-[#1c2a2f]' : 'border border-line bg-paper text-ink hover:border-ink'}`
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <div className="max-w-[92%] rounded-[18px] bg-paper p-3 text-[14px] text-text shadow-[0_0_0_1px_rgba(8,17,19,.05)]">{children}</div>
}

function ToolView({ name, id, output, t, done, mark }: { name: string; id: string; output: Record<string, unknown>; t: Copy; done: Record<string, string>; mark: (k: string, v: string) => void }) {
  const locale = useLocale()
  const gate = useGate()
  const { add, dismissConfirmation } = useCart()
  const base = locale === 'en' ? '/en' : ''
  const addLine = (productId: string, variantId: string | undefined, quantity: number) => {
    if (add(productId as ProductId, variantId, quantity, 'assistant')) {
      // The chat shows its own confirmation; the cart popup would cover it.
      dismissConfirmation()
      mark(id, 'added')
    }
  }
  const afterAdd = (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[13.5px] font-medium text-[#167a4a]">
        <Check className="h-4 w-4" /> {t.added}
      </span>
      <Btn href={`${base}/cart`}>{t.cart}</Btn>
      <Btn href={`${base}/checkout`} primary>
        {t.checkout}
      </Btn>
    </div>
  )

  if (name === 'show_products') {
    const list = (output.products as { id: string; name: string; purpose: string; href: string; price?: string; promotion?: string; soldOut?: boolean; variants?: unknown[] }[]) ?? []
    // One compact row per product (no sideways scrolling, so it reads well on a phone): picture, name, price, action.
    return (
      <ul className="w-full max-w-[420px] space-y-2">
        {list.map((p) => {
          const product = getProduct(p.id, locale)
          if (!product) return null
          const key = `${id}:${p.id}`
          const action = p.soldOut ? (
            <span className="text-[12.5px] text-muted">{t.soldOut}</span>
          ) : output.locked ? (
            <SmallBtn primary onClick={() => gate.open({ productId: p.id as ProductId })}>
              {t.seePrice}
            </SmallBtn>
          ) : done[key] === 'added' ? (
            <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#167a4a]">
              <Check className="h-4 w-4" /> {t.added}
            </span>
          ) : p.variants?.length ? (
            <SmallBtn primary href={p.href}>
              {product.chooseLabel ?? t.view}
            </SmallBtn>
          ) : (
            <SmallBtn
              primary
              onClick={() => {
                if (add(p.id as ProductId, undefined, 1, 'assistant')) {
                  dismissConfirmation()
                  mark(key, 'added')
                }
              }}
            >
              {t.add}
            </SmallBtn>
          )
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-[16px] bg-paper p-2.5 shadow-[0_0_0_1px_rgba(8,17,19,.05)]">
              <Link href={p.href} className="flex min-w-0 flex-1 items-center gap-3" aria-label={`${t.view}: ${p.name}`}>
                <Thumb image={product.cutout} sizes="64px" className="h-16 w-16 flex-none bg-mist" />
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">{p.name}</span>
                  <span className="block truncate text-[12.5px] text-muted">{p.purpose}</span>
                  {p.price && <span className="block text-[13.5px] font-semibold text-ink tabular-nums">{p.price}</span>}
                  {p.promotion && <span className="block truncate text-[11.5px] font-medium text-cyan-700">{p.promotion}</span>}
                </span>
              </Link>
              <span className="flex-none">{action}</span>
            </li>
          )
        })}
      </ul>
    )
  }

  if (name === 'propose_add_to_cart') {
    const o = output as { status: string; productId: string; variantId?: string; variant?: string; name: string; quantity?: number; unitPrice?: string; variants?: { id: string; label: string; price: string }[] }
    const product = getProduct(o.productId, locale)
    if (o.status === 'locked')
      return (
        <Card>
          <p className="font-medium text-ink">{o.name}</p>
          <div className="mt-2">
            <Btn primary onClick={() => gate.open({ productId: o.productId as ProductId })}>
              {t.seePrice}
            </Btn>
          </div>
        </Card>
      )
    if (o.status === 'sold_out' || o.status === 'unavailable')
      return (
        <Card>
          {o.name}: {t.soldOut.toLowerCase()}
        </Card>
      )
    const state = done[id]
    return (
      <Card>
        <div className="flex items-center gap-3">
          {product && <Thumb image={product.cutout} className="h-14 w-14 bg-mist" />}
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {o.quantity ?? 1} × {o.name}
            </p>
            {o.variant && <p className="text-[13px] text-muted">{o.variant}</p>}
            {o.unitPrice && <p className="text-[13.5px] text-text">{o.unitPrice} / buc.</p>}
          </div>
        </div>
        {state === 'added' ? (
          afterAdd
        ) : state === 'no' ? null : o.status === 'choose_variant' ? (
          <>
            <p className="mt-2.5 text-[13px] text-muted">{t.chooseFrame}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {o.variants?.map((v) => (
                <button key={v.id} type="button" onClick={() => addLine(o.productId, v.id, o.quantity ?? 1)} className="rounded-full border border-line px-3 py-1.5 text-[13px] text-ink hover:border-ink">
                  {v.label} · {v.price}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Btn primary onClick={() => addLine(o.productId, o.variantId, o.quantity ?? 1)}>
              {t.add}
            </Btn>
            <Btn onClick={() => mark(id, 'no')}>{t.notNow}</Btn>
          </div>
        )}
      </Card>
    )
  }

  if (name === 'cart_summary' && !output.empty && !output.locked) {
    const o = output as { items: string[]; promotions: string[]; total: string }
    return (
      <Card>
        <ul className="space-y-0.5">
          {o.items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        {o.promotions.map((x) => (
          <p key={x} className="mt-1 text-[13px] text-cyan-700">
            {x}
          </p>
        ))}
        <p className="mt-1.5 font-semibold text-ink">
          {t.total}: {o.total}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Btn href={`${base}/cart`}>{t.cart}</Btn>
          <Btn href={`${base}/checkout`} primary>
            {t.checkout}
          </Btn>
        </div>
      </Card>
    )
  }

  if (name === 'open_page') {
    const o = output as { page: string; href: string; label: string }
    return (
      <div>
        <Btn href={o.href} primary={o.page === 'checkout'}>
          {o.label} <Arrow className="h-4 w-4" />
        </Btn>
      </div>
    )
  }

  if (name === 'show_price_form' && output.locked)
    return (
      <div>
        <Btn primary onClick={() => gate.open({ productId: (output.productId as ProductId) || undefined })}>
          {t.seePrice}
        </Btn>
      </div>
    )

  if ((name === 'verify_order_code' || name === 'get_order_status') && output.verified && output.order) {
    const o = output.order as { orderNumber: string; status: string; payment: string; items: string[]; total: string; awb?: string; courier?: string; trackingUrl?: string }
    return (
      <Card>
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#167a4a]">
          <Check className="h-4 w-4" /> {t.verified}: {o.orderNumber}
        </p>
        <p className="mt-1.5">
          <span className="text-muted">{t.status}:</span> <b className="font-semibold text-ink">{o.status}</b>
        </p>
        <p>
          <span className="text-muted">{t.payment}:</span> {o.payment}
        </p>
        <ul className="mt-1">
          {o.items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className="mt-1 font-semibold text-ink">
          {t.total}: {o.total}
        </p>
        {o.awb && (
          <p className="mt-1">
            <span className="text-muted">{t.awb}:</span> {o.courier ? `${o.courier} ` : ''}
            {o.awb}
            {o.trackingUrl && /^https:\/\//.test(o.trackingUrl) && (
              <>
                {' · '}
                <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline underline-offset-4">
                  {t.track}
                </a>
              </>
            )}
          </p>
        )}
      </Card>
    )
  }

  if (name === 'propose_cancellation' && output.eligible) return <CancelCard id={id} o={output as { orderNumber: string; items: string[]; total: string; cancelToken: string }} t={t} done={done} mark={mark} />

  if (name === 'create_support_request' && output.created)
    return (
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#167a4a]">
        <Check className="h-4 w-4" /> {t.request}: {String(output.reference)}
      </p>
    )

  return null
}

function CancelCard({ id, o, t, done, mark }: { id: string; o: { orderNumber: string; items: string[]; total: string; cancelToken: string }; t: Copy; done: Record<string, string>; mark: (k: string, v: string) => void }) {
  const [state, setState] = useState<'idle' | 'busy'>('idle')
  const [problem, setProblem] = useState('')
  const result = done[id]
  const confirm = async () => {
    setState('busy')
    setProblem('')
    try {
      const res = await fetch('/api/assistant/cancel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: o.cancelToken }) })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (data.ok) mark(id, 'cancelled')
      else setProblem(data.message ?? t.cancelFail)
    } catch {
      setProblem(t.cancelFail)
    }
    setState('idle')
  }
  return (
    <Card>
      <p className="font-semibold text-ink">{t.cancelAsk}</p>
      <p className="mt-1 text-[13px] text-muted">{o.orderNumber}</p>
      <ul className="mt-1">
        {o.items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <p className="mt-1 font-semibold text-ink">
        {t.total}: {o.total}
      </p>
      {result === 'cancelled' ? (
        <p className="mt-2 flex items-center gap-1.5 text-[13.5px] font-medium text-[#167a4a]">
          <Check className="h-4 w-4" /> {t.cancelled(o.orderNumber)}
        </p>
      ) : result === 'no' ? null : (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button type="button" disabled={state === 'busy'} onClick={() => void confirm()} className="rounded-full bg-red-deep px-3.5 py-2 text-[13.5px] font-medium text-white disabled:opacity-50">
            {t.cancelYes}
          </button>
          <Btn onClick={() => mark(id, 'no')}>{t.cancelNo}</Btn>
        </div>
      )}
      {problem && <p className="mt-2 text-[13.5px] text-red-deep">{problem}</p>}
    </Card>
  )
}

/**
 * The greeting above the chat button, like an incoming iMessage: three typing dots grow out of the button, then the
 * message bubble (with its tail toward the button) replaces them and the notification "ping" plays. Browsers allow
 * sound only after the visitor touched the page; until then the ping waits for the first touch, once. The replies
 * open the chat. It stays (gently floating) until opened or closed, for the rest of the visit.
 */
function Teaser({ t, fresh, bottom, onOpen, onClose }: { t: Copy; fresh: boolean; bottom: string; onOpen: (text?: string) => void; onClose: () => void }) {
  const [typing, setTyping] = useState(fresh)
  // Bumped when the sound plays later than the bubble (sound blocked until the first touch): the pop replays with it.
  const [pop, setPop] = useState(0)
  useEffect(() => {
    if (!fresh) return
    // The message replaces the dots and the sound starts in the same moment, so the pop and the first note land together.
    const show = setTimeout(() => {
      setTyping(false)
      ping(() => setPop((n) => n + 1))
    }, 1400)
    return () => clearTimeout(show)
  }, [fresh])
  return (
    <div role="status" aria-live="polite" style={{ bottom }} className="fixed right-4 z-[231] flex w-[min(290px,calc(100vw-32px))] flex-col items-end sm:right-5 print:hidden">
      <p className={`mb-1 mr-3 flex items-center gap-1.5 text-[11px] text-muted ${fresh ? 'assistant-teaser-in' : ''}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" aria-hidden />
        {t.teaserFrom}
      </p>
      {typing ? (
        <div className="assistant-teaser-in imsg-in relative mr-1 flex w-fit items-center gap-1 rounded-[20px] px-4 py-3.5" aria-label="…">
          {[0, 1, 2].map((i) => (
            <span key={i} className="assistant-dot h-2 w-2 rounded-full bg-[#8e8e93]" style={{ animationDelay: `${i * 0.16}s` }} />
          ))}
        </div>
      ) : (
        <div key={pop} className={`assistant-teaser-float w-full ${fresh || pop ? 'assistant-teaser-pop' : ''}`}>
          <div className="relative">
            <button type="button" onClick={() => onOpen()} className="imsg-in relative block w-full rounded-[20px] px-4 py-2.5 text-left text-[15.5px] leading-snug text-black">
              {t.teaserText}
              {/* The bubble's tail, toward the chat button. */}
              <svg viewBox="0 0 17 21" aria-hidden className="absolute -right-[6px] bottom-0 h-[21px] w-[17px] text-[#e9e9eb]">
                <path fill="currentColor" d="M0 0v14c0 4 2 7 6 7 4 0 8-1 11-3-4-1-6-4-7-8C9 6 9 3 9 0H0Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.teaserClose}
              className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-paper text-muted shadow-[0_1px_4px_rgba(0,0,0,.18)] hover:text-ink"
            >
              <Close className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {t.teaserReplies.map((r, i) => (
              <button
                key={r}
                type="button"
                onClick={() => onOpen(i === 0 ? t.suggestions[0] : undefined)}
                className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-medium shadow-[0_4px_14px_-6px_rgba(0,0,0,.25)] transition-transform active:scale-95 ${i === 0 ? 'bg-[#0a84ff] text-white' : 'bg-paper text-[#0a84ff]'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

let pinged = false
/** The notification sound the admin chose (/admin/setari); waits for the first touch when the browser blocks sound. */
function ping(onLate?: () => void) {
  if (pinged || typeof window === 'undefined') return
  const choice = (window.__BT_STORE__ as { chatSound?: string } | undefined)?.chatSound
  const sound: ChatSound = isChatSound(choice) ? choice : 'ping'
  if (sound === 'off') return
  try {
    const ctx = newAudioContext()
    if (!ctx) return
    const play = () => {
      if (pinged) return
      pinged = true
      playChatSound(ctx, sound)
    }
    if (ctx.state === 'running') return play()
    // A context created without a touch starts suspended; resume() succeeds at once only when sound is allowed.
    void ctx.resume().then(() => (ctx.state === 'running' ? play() : undefined))
    // Still blocked (no touch yet): the sound plays on the first touch, key or click.
    const later = () => {
      remove()
      void ctx.resume().then(() => {
        if (pinged) return
        play()
        // The bubble pops again with the sound, so the two stay together.
        onLate?.()
      })
    }
    const remove = () => ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, later))
    ;['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, later, { once: true, passive: true }))
  } catch {}
}
