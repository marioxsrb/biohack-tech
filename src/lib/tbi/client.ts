/**
 * TBI Bank Fusion Pay (RO) API, as documented in "API documentation - RO Fusion Pay" (TBI Confluence):
 * GetCalculations (the merchant's repayment schemes), RegisterApplication (sends the basket, answers with the URL
 * where the customer chooses a scheme and fills in the application), GetApplicationStatus, and the status updates
 * TBI posts to our statusURL. Authentication is reseller_code + reseller_key in the body; RegisterApplication's
 * `data` and the status updates are encrypted (lib/tbi/cryptor.ts). Endpoints: {apiBase}/{Method}.
 * Server-only: the reseller key and the encryption key never reach the browser.
 * Not used here on purpose: loanCancellation and loanRefund.
 */
import 'server-only'
import { tbiEncrypt } from '@/lib/tbi/cryptor'
import type { TbiConfig } from '@/server/config'

export type TbiScheme = {
  scheme_id: number
  promo_code: number
  ftos_product: string
  name: string
  period: number
  analysis_fee: number
  insurance: number
  nir: number
  installment_factor: number
  total_due_factor: number
  amount_min: number
  amount_max: number
}

export class TbiError extends Error {
  constructor(public code: number, message: string) {
    super(message)
  }
}

const TIMEOUT_MS = 15_000

async function post<T>(cfg: TbiConfig, method: string, body: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<T> {
  const res = await fetchImpl(`${cfg.apiBase}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ reseller_code: cfg.resellerCode, reseller_key: cfg.resellerKey, ...body }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
  const text = await res.text()
  let j: unknown
  try {
    j = JSON.parse(text)
  } catch {
    throw new TbiError(res.status, `tbi ${method}: HTTP ${res.status}, not JSON: ${text.slice(0, 120)}`)
  }
  // Errors come as {error: <code>, message}; RegisterApplication's success is error 0.
  const e = j as { error?: number; message?: string }
  if (e && typeof e === 'object' && !Array.isArray(e) && typeof e.error === 'number' && e.error !== 0) {
    throw new TbiError(e.error, `tbi ${method}: ${e.error} ${e.message ?? ''}`.trim())
  }
  if (!res.ok) throw new TbiError(res.status, `tbi ${method}: HTTP ${res.status}`)
  return j as T
}

// ---------------------------------------------------------------- GetCalculations (cached 24 h, per TBI's advice)

const DAY = 24 * 3_600_000
const schemesCache = new Map<string, { at: number; schemes: TbiScheme[] }>()

/** The merchant's schemes; cached 24 h. When TBI does not answer, the last known list (stale) or the error. */
export async function getCalculations(cfg: TbiConfig, opts: { now?: number; fetchImpl?: typeof fetch; force?: boolean } = {}): Promise<{ schemes: TbiScheme[]; cachedAt: number; stale: boolean }> {
  const now = opts.now ?? Date.now()
  const key = `${cfg.apiBase}|${cfg.resellerCode}`
  const hit = schemesCache.get(key)
  if (hit && !opts.force && now - hit.at < DAY) return { schemes: hit.schemes, cachedAt: hit.at, stale: false }
  try {
    const raw = await post<TbiScheme[]>(cfg, 'GetCalculations', {}, opts.fetchImpl)
    if (!Array.isArray(raw)) throw new TbiError(0, 'tbi GetCalculations: not a list')
    const schemes = raw.map((s) => ({ ...s, period: Number(s.period), analysis_fee: Number(s.analysis_fee), nir: Number(s.nir), installment_factor: Number(s.installment_factor), total_due_factor: Number(s.total_due_factor), amount_min: Number(s.amount_min), amount_max: Number(s.amount_max), insurance: Number(s.insurance) }))
    schemesCache.set(key, { at: now, schemes })
    return { schemes, cachedAt: now, stale: false }
  } catch (e) {
    if (hit) return { schemes: hit.schemes, cachedAt: hit.at, stale: true }
    throw e
  }
}
/** Test helper. */
export const resetTbiSchemes = () => schemesCache.clear()

export type TbiSchemeQuote = { schemeId: number; name: string; ftosProduct: string; period: number; nir: number; analysisFee: number; monthly: number; total: number }

/** The schemes that finance `amount` (lei), with TBI's formula: monthly = (amount + analysis_fee) × installment_factor. */
export function quoteSchemes(schemes: TbiScheme[], amount: number): TbiSchemeQuote[] {
  const r2 = (n: number) => Math.round(n * 100) / 100
  return schemes
    .filter((s) => amount >= s.amount_min && amount <= s.amount_max)
    .map((s) => {
      const base = amount + s.analysis_fee
      return { schemeId: s.scheme_id, name: s.name, ftosProduct: s.ftos_product, period: s.period, nir: s.nir, analysisFee: s.analysis_fee, monthly: r2(base * s.installment_factor), total: r2(base * s.total_due_factor) }
    })
    .sort((a, b) => a.period - b.period)
}

// ---------------------------------------------------------------- RegisterApplication

export type TbiItem = { name: string; description?: string; qty: number; price: number; sku: string; category: number; imagelink: string }
export type TbiApplication = {
  orderid: string
  firstname?: string
  lastname?: string
  email?: string
  phone?: string
  items: TbiItem[]
  statusURL?: string
  successRedirectURL?: string
  failRedirectURL?: string
}
export type TbiRegistered = { order_id: number; token: string; url: string }

export async function registerApplication(cfg: TbiConfig, app: TbiApplication, fetchImpl?: typeof fetch): Promise<TbiRegistered> {
  if (!app.orderid || !app.items.length) throw new TbiError(208, 'tbi: orderid and items are required')
  const r = await post<TbiRegistered & { error: number }>(cfg, 'RegisterApplication', { data: tbiEncrypt(JSON.stringify(app), cfg.encryptionKey) }, fetchImpl)
  if (!r.url || !/^https:\/\//.test(r.url)) throw new TbiError(0, 'tbi RegisterApplication: no url in the answer')
  return { order_id: Number(r.order_id), token: String(r.token), url: r.url }
}

export type TbiStatusChain = { error: number; store_order_id: string; status: string; status_chain: { datetime: string; status: string }[] }
export const getApplicationStatus = (cfg: TbiConfig, orderId: number, token: string, fetchImpl?: typeof fetch) =>
  post<TbiStatusChain>(cfg, 'GetApplicationStatus', { order_id: orderId, token }, fetchImpl)

// ---------------------------------------------------------------- status updates (statusURL)

export type TbiStatusUpdate = { command: string; orderId: string; status: number | null; message: string; motive: string; contract: string }

/**
 * The decrypted status update. The documentation's table says OrderId / Status / Message / Motive / Contract_id
 * and its example ContractNumber, while its encrypted example decrypts to order_id / status (a number) / message /
 * motive / contract_id: every spelling is accepted, case-insensitively.
 */
export function parseStatusUpdate(raw: unknown): TbiStatusUpdate {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const lower = new Map(Object.entries(o).map(([k, v]) => [k.toLowerCase().replace(/[^a-z]/g, ''), v]))
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = lower.get(k)
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
    }
    return ''
  }
  const st = pick('status')
  return {
    command: pick('command'),
    orderId: pick('orderid', 'storeorderid'),
    status: /^-?\d+$/.test(st) ? Number(st) : null,
    message: pick('message'),
    motive: pick('motive'),
    contract: pick('contractnumber', 'contractid'),
  }
}

/** TBI's application statuses: 2 in progress, 1 approved, 0 cancelled, 3 rejected (4–6 are refund statuses). */
export const TBI_STATUS_LABEL: Record<number, string> = { 2: 'În curs la TBI', 1: 'Aprobat de TBI', 0: 'Anulat', 3: 'Respins de TBI', 4: 'Refund înregistrat', 5: 'Refund în procesare', 6: 'Refund finalizat' }
