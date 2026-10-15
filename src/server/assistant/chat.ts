/**
 * One turn of the website assistant: the conversation the browser sent (validated, trimmed, stripped of anything
 * that is not plain text or our own tool results), the store's context (locked prices on acces.<domain>, the cart,
 * the orders proved with the email code), and a streamed answer from a small, fast model through the AI Gateway
 * (ASSISTANT_MODEL, e.g. anthropic/claude-haiku-5.5). Nothing of the conversation is stored on the server.
 */
import 'server-only'
import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type LanguageModel, type StreamTextTransform, type ToolSet, type UIMessage } from 'ai'
import type { Config } from '@/server/config'
import type { Queryable } from '@/server/db'
import { log, errText } from '@/server/log'
import { orders } from '@/server/orders/repository'
import { readToken } from './orders'
import { assistantInstructions, maskAmounts, type AssistantContext } from './prompt'
import { assistantTools, type CartInput } from './tools'

export const DEFAULT_MODEL = 'anthropic/claude-haiku-5.5'
/** The configured model (a gateway "provider/model" id); "mock" is the scripted stand-in, outside production only. */
export async function assistantModel(): Promise<LanguageModel> {
  const id = process.env.ASSISTANT_MODEL || DEFAULT_MODEL
  if (id === 'mock' && process.env.APP_ENV !== 'production' && process.env.VERCEL_ENV !== 'production') return (await import('./mock-model')).scriptedModel()
  return id === 'mock' ? DEFAULT_MODEL : id
}

export const MAX_MESSAGES = 24
export const MAX_USER_CHARS = 1500
const TOOL_NAMES = new Set(['show_products', 'propose_add_to_cart', 'cart_summary', 'open_page', 'show_price_form', 'request_order_code', 'verify_order_code', 'get_order_status', 'propose_cancellation', 'create_support_request'])
/** Fields of our own tool results that only the browser and the server need (signed tokens). */
const SECRET_FIELDS = ['ref', 'cancelToken'] as const

type Part = Record<string, unknown> & { type: string }

/**
 * The conversation as the browser sent it, reduced to what may reach the model: the last messages only, user
 * messages as plain text (bounded), assistant messages as text and finished results of our own tools. Anything
 * else (system messages, files, unknown parts, half-finished tool calls) is dropped.
 */
export function cleanMessages(raw: unknown): UIMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) return null
  const out: UIMessage[] = []
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (!m || typeof m !== 'object') continue
    const { id, role, parts } = m as { id?: unknown; role?: unknown; parts?: unknown }
    if ((role !== 'user' && role !== 'assistant') || !Array.isArray(parts)) continue
    const kept: Part[] = []
    for (const p of parts as Part[]) {
      if (!p || typeof p !== 'object' || typeof p.type !== 'string') continue
      if (p.type === 'text' && typeof p.text === 'string') {
        const text = role === 'user' ? p.text.slice(0, MAX_USER_CHARS) : p.text.slice(0, 4000)
        if (text.trim()) kept.push({ type: 'text', text })
      } else if (role === 'assistant' && p.type.startsWith('tool-') && TOOL_NAMES.has(p.type.slice(5)) && p.state === 'output-available' && typeof p.toolCallId === 'string') {
        kept.push({ type: p.type, toolCallId: p.toolCallId.slice(0, 100), state: 'output-available', input: p.input ?? {}, output: p.output ?? null })
      }
    }
    if (kept.length) out.push({ id: typeof id === 'string' ? id.slice(0, 100) : crypto.randomUUID(), role, parts: kept } as UIMessage)
  }
  return out.length && out[out.length - 1].role === 'user' ? out : null
}

/** The orders this conversation proved with the email code: valid signed references in our own tool results. */
export async function verifiedOrders(q: Queryable, messages: UIMessage[]): Promise<Map<string, string>> {
  const ids = new Set<string>()
  for (const m of messages)
    for (const p of m.parts as Part[]) {
      if (p.type !== 'tool-verify_order_code') continue
      const id = readToken('ref', (p.output as { ref?: unknown } | null)?.ref)
      if (id) ids.add(id)
    }
  const map = new Map<string, string>()
  for (const id of [...ids].slice(0, 5)) {
    const o = await orders.byId(q, id)
    if (o) map.set(o.orderNumber, o.id)
  }
  return map
}

/** The same conversation without the signed tokens (the model never needs them). */
function withoutSecrets(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: (m.parts as Part[]).map((p) => {
      if (!p.type.startsWith('tool-') || !p.output || typeof p.output !== 'object') return p
      const output = { ...(p.output as Record<string, unknown>) }
      for (const f of SECRET_FIELDS) delete output[f]
      return { ...p, output }
    }),
  })) as UIMessage[]
}

/**
 * On a locked page, amounts in the model's text are blanked before they leave the server. Text is held back until
 * a word boundary (and the last two words are kept) so "6.380" and "lei" in separate chunks are still caught.
 */
export function lockedTextGuard<T extends ToolSet>(): StreamTextTransform<T> {
  return () => {
    let buffer = ''
    let id = ''
    const flush = (controller: TransformStreamDefaultController<never>, all: boolean) => {
      if (!buffer) return
      const masked = maskAmounts(buffer)
      if (all) {
        controller.enqueue({ type: 'text-delta', id, text: masked } as never)
        buffer = ''
        return
      }
      // Keep the last two words back: an amount may still be completing.
      const m = /(\S+\s+\S*\s*)$/.exec(masked)
      const cut = m ? masked.length - m[1].length : 0
      if (cut > 0) {
        controller.enqueue({ type: 'text-delta', id, text: masked.slice(0, cut) } as never)
        buffer = masked.slice(cut)
      } else buffer = masked
    }
    return new TransformStream({
      transform(chunk, controller) {
        const c = chunk as { type: string; id?: string; text?: string }
        if (c.type === 'text-delta') {
          if (buffer && c.id !== id) flush(controller as never, true)
          id = c.id ?? id
          buffer += c.text ?? ''
          flush(controller as never, false)
          return
        }
        flush(controller as never, true)
        controller.enqueue(chunk)
      },
      flush(controller) {
        flush(controller as never, true)
      },
    })
  }
}

export type TurnInput = {
  db: Queryable
  config: Config
  context: AssistantContext
  messages: UIMessage[]
  cart: CartInput
  model?: LanguageModel
  onQueued?: () => void
}

export async function assistantTurn(x: TurnInput): Promise<Response> {
  const verified = await verifiedOrders(x.db, x.messages)
  const tools = assistantTools({ db: x.db, config: x.config, locked: x.context.locked, gated: x.context.gated, locale: x.context.locale, cart: x.cart, verified, onQueued: x.onQueued ?? (() => {}) })
  const result = streamText({
    model: x.model ?? (await assistantModel()),
    instructions: assistantInstructions(x.context),
    messages: await convertToModelMessages(withoutSecrets(x.messages), { tools }),
    tools,
    stopWhen: isStepCount(5),
    maxOutputTokens: 700,
    temperature: 0.3,
    ...(x.context.locked && { experimental_transform: lockedTextGuard<typeof tools>() }),
    onError: ({ error }) => log.error('assistant.model_error', { error: errText(error) }),
  })
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      onError: () => (x.context.locale === 'en' ? 'Sorry, I cannot answer right now. Please try again in a moment.' : 'Nu pot răspunde chiar acum. Te rog încearcă din nou peste câteva momente.'),
    }),
  })
}

/** On unless switched off in /admin/setari (or ASSISTANT_ENABLED=false as an emergency stop). */
export async function assistantEnabled() {
  if (process.env.ASSISTANT_ENABLED === 'false') return false
  const { ensureStoreSettings } = await import('@/server/store-settings')
  return (await ensureStoreSettings()).assistant
}
