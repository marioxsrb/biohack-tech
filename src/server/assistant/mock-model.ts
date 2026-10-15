/**
 * A scripted stand-in for the language model (ASSISTANT_MODEL=mock, never in production): it answers from simple
 * keywords with the same tool calls the real model makes, so the chat, the cards, the cart, the order code and the
 * cancellation can be tried end to end without an AI key. Tests use it too.
 */
import 'server-only'
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

type Msg = { role: string; content: unknown }
type Step = { text?: string; tool?: { name: string; input: Record<string, unknown> } }

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 10, text: 10, reasoning: undefined } }

const textOf = (m: Msg | undefined) =>
  !m ? '' : typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map((p: { type?: string; text?: string }) => (p.type === 'text' ? (p.text ?? '') : '')).join(' ') : ''

/** What the scripted assistant does for the conversation so far. */
export function scriptedStep(prompt: Msg[]): Step {
  const last = prompt[prompt.length - 1]
  if (last?.role === 'tool') {
    const out = JSON.stringify(last.content)
    if (out.includes('"sent"')) return { text: 'Dacă datele se potrivesc, ți-am trimis un cod pe email. Scrie-mi codul de 6 cifre.' }
    if (out.includes('"verified":true')) return { text: 'Am verificat comanda. Iată detaliile.' }
    if (out.includes('"eligible":true')) return { text: 'Comanda se poate anula. Confirmă cu butonul de mai jos.' }
    if (out.includes('"eligible":false')) return { text: 'Comanda nu se poate anula din asistent. Pot trimite o cerere către echipă.' }
    if (out.includes('"created":true')) return { text: 'Am trimis cererea către echipă. Îți răspundem în cel mult 24 de ore.' }
    return { text: 'Iată ce am găsit.' }
  }
  const all = prompt.filter((m) => m.role === 'user').map(textOf).join('\n')
  const q = textOf([...prompt].reverse().find((m) => m.role === 'user')).toLowerCase()
  const number = /BHT-\d{8}-\d{4,}/i.exec(all)?.[0]
  const email = /[\w.+-]+@[\w-]+\.[\w.]+/.exec(q)?.[0]
  const code = /\b\d{6}\b/.exec(q)?.[0]
  if (/ignor|instruc|prompt|admin/.test(q)) return { text: 'Te pot ajuta doar cu produsele și comenzile Biohack Tech.' }
  if (number && code) return { tool: { name: 'verify_order_code', input: { orderNumber: number, code } } }
  if (number && email) return { tool: { name: 'request_order_code', input: { orderNumber: number, email } } }
  if (/anul/.test(q) && number) return { tool: { name: 'propose_cancellation', input: { orderNumber: number } } }
  if (/stare|status/.test(q) && number) return { tool: { name: 'get_order_status', input: { orderNumber: number } } }
  if (/comand/.test(q)) return { text: 'Te ajut cu plăcere. Scrie-mi numărul comenzii (BHT-…) și emailul folosit la comandă.' }
  if (/cineva|om\b|retur/.test(q)) return { tool: { name: 'create_support_request', input: { category: /retur/.test(q) ? 'return' : 'other', summary: q.slice(0, 200), email: email ?? 'test@example.com' } } }
  if (/preț|pret|cost/.test(q)) return { text: 'NEUROS Calm costă 6.380 lei, iar la 2 bucăți ai 10% reducere.' }
  if (/coș|cos|cumpăr|adaug/.test(q)) return { tool: { name: 'propose_add_to_cart', input: { productId: /amber/.test(q) ? 'ochelari-biohack' : 'balance-wave', quantity: 1 } } }
  if (/diferen|compar/.test(q)) return { tool: { name: 'show_products', input: { productIds: ['balance-wave', 'brainlink-pro'] } } }
  if (/potriv|recomand|produs/.test(q)) return { tool: { name: 'show_products', input: { productIds: ['balance-wave', 'brainlink-pro', 'ochelari-biohack'] } } }
  if (/rețet|vreme|politic/.test(q)) return { text: 'Pot ajuta doar cu întrebări despre Biohack Tech: produse, comenzi, livrare și retur.' }
  return { text: 'Spune-mi ce îți dorești: relaxare, concentrare sau protecție seara în fața ecranelor?' }
}

export function scriptedModel(step: (prompt: Msg[]) => Step = scriptedStep) {
  return new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      const s = step(prompt as Msg[])
      const chunks: unknown[] = [{ type: 'stream-start', warnings: [] }]
      if (s.text) {
        chunks.push({ type: 'text-start', id: 't1' })
        for (const w of s.text.match(/\S+\s*/g) ?? []) chunks.push({ type: 'text-delta', id: 't1', delta: w })
        chunks.push({ type: 'text-end', id: 't1' })
      }
      if (s.tool) chunks.push({ type: 'tool-call', toolCallId: `call-${Math.random().toString(36).slice(2, 10)}`, toolName: s.tool.name, input: JSON.stringify(s.tool.input) })
      chunks.push({ type: 'finish', finishReason: { unified: s.tool ? 'tool-calls' : 'stop', raw: undefined }, usage })
      return { stream: simulateReadableStream({ chunks: chunks as never[], chunkDelayInMs: 15 }) }
    },
  })
}
