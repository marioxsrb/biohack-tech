/**
 * The store settings an admin changes without a deploy: prices per product (or per frame), stock, the website
 * popup and a pause for AI calls. Kept in Supabase (store_settings), applied over the catalog on every server
 * instance (refreshed at most every 15 seconds) and carried to the browser by the page. Every change is
 * validated here and written to admin_audit.
 *
 * The automatic promotions (10%/20%, Amber 2+1) are not settings: their wording appears across the site, the
 * terms and the AI agent, so they change together with that text, in code.
 */
import 'server-only'
import { cache } from 'react'
import { applyCatalogOverrides, getProduct, products, type CatalogOverrides } from '@/content/catalog'
import { PRICES_RON, type PriceEntry } from '@/config/prices'
import type { Queryable } from '@/server/db'
import { getDb } from '@/server/db'
import { errText, log } from '@/server/log'
import { jobs } from '@/server/jobs/outbox'

export type StoreSettings = {
  /** Bani per product (or per variant id for per-frame prices); a product left out keeps config/prices.ts. */
  prices: Partial<Record<string, PriceEntry>>
  soldOut: string[]
  welcomePopup: boolean
  callsPaused: boolean
  /** The chat assistant (bottom-right bubble) on every site. */
  assistant: boolean
}

export const DEFAULT_SETTINGS: StoreSettings = { prices: {}, soldOut: [], welcomePopup: true, callsPaused: false, assistant: true }

/** Prices outside this range are refused (a typo of one zero too many or too few). */
export const PRICE_MIN = 100 // 1 leu
export const PRICE_MAX = 10_000_000 // 100.000 lei

let current: StoreSettings = DEFAULT_SETTINGS
let loadedAt = 0
let loading: Promise<StoreSettings> | null = null

export const storeSettings = () => current

const toOverrides = (s: StoreSettings): CatalogOverrides => ({ prices: s.prices, soldOut: s.soldOut })

function normalize(raw: unknown): StoreSettings {
  const v = (raw ?? {}) as Partial<StoreSettings>
  return {
    prices: v.prices && typeof v.prices === 'object' ? v.prices : {},
    soldOut: Array.isArray(v.soldOut) ? v.soldOut.filter((x) => typeof x === 'string') : [],
    welcomePopup: v.welcomePopup !== false,
    callsPaused: v.callsPaused === true,
    assistant: v.assistant !== false,
  }
}

export async function readStoreSettings(q: Queryable): Promise<StoreSettings> {
  const { rows } = await q.query<{ value: unknown }>("select value from store_settings where key = 'store'")
  return normalize(rows[0]?.value)
}

/**
 * Loads the settings (at most every 15 seconds per instance) and applies them over the catalog. Called before
 * anything shows or charges a price; without a database (or on an error) the code's prices stay.
 */
export async function ensureStoreSettings(maxAgeMs = 15_000): Promise<StoreSettings> {
  if (Date.now() - loadedAt < maxAgeMs) return current
  loading ??= (async () => {
    try {
      current = await readStoreSettings(await getDb())
      applyCatalogOverrides(toOverrides(current))
    } catch (e) {
      log.warn('store_settings.load_failed', { error: errText(e) })
    } finally {
      loadedAt = Date.now()
      loading = null
    }
    return current
  })()
  return loading
}

/** What the page tells the browser (the script runs before the app, so the first render already uses it). */
export function storeScript(s: StoreSettings = current) {
  return `window.__BT_STORE__=${JSON.stringify({ ...toOverrides(s), welcomePopup: s.welcomePopup, assistant: s.assistant }).replace(/</g, '\\u003c')};`
}

export type SettingsProblem = { field: string; message: string }

/** Checks a change before it is saved; returns the problems in Romanian (empty: valid). */
export function validateSettings(s: StoreSettings): SettingsProblem[] {
  const problems: SettingsProblem[] = []
  for (const [id, entry] of Object.entries(s.prices)) {
    const p = getProduct(id)
    if (!p) {
      problems.push({ field: id, message: `Produs necunoscut: ${id}` })
      continue
    }
    const check = (v: unknown, where: string) => {
      if (v === null) return
      if (typeof v !== 'number' || !Number.isInteger(v) || v < PRICE_MIN || v > PRICE_MAX) problems.push({ field: where, message: `${p.name}${where !== id ? ` (${where.split('/')[1]})` : ''}: prețul trebuie să fie între 1 și 100.000 lei.` })
    }
    if (typeof entry === 'object' && entry !== null) {
      for (const [vid, v] of Object.entries(entry)) {
        if (!p.variants?.some((x) => x.id === vid)) problems.push({ field: `${id}/${vid}`, message: `${p.name}: variantă necunoscută ${vid}` })
        else check(v, `${id}/${vid}`)
      }
    } else check(entry, id)
  }
  for (const id of s.soldOut) if (!getProduct(id)) problems.push({ field: id, message: `Produs necunoscut: ${id}` })
  return problems
}

/** Saves the whole settings object (after validation), records who changed what, and applies it at once here. */
export async function saveStoreSettings(q: Queryable, next: StoreSettings, actor: string) {
  const problems = validateSettings(next)
  if (problems.length) return { ok: false as const, problems }
  const before = await readStoreSettings(q)
  await q.query(
    `insert into store_settings (key, value, updated_at, updated_by) values ('store', $1, now(), $2)
     on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`,
    [JSON.stringify(next), actor],
  )
  await audit(q, actor, 'settings.update', { before, after: next })
  // The AI agent quotes prices: it gets the new ones (a job, retried on its own; one per minute at most).
  if (JSON.stringify(before.prices) !== JSON.stringify(next.prices) || JSON.stringify(before.soldOut) !== JSON.stringify(next.soldOut))
    await jobs.enqueue(q, { kind: 'agent.sync', dedupeKey: `agent.sync:${Math.floor(Date.now() / 60_000)}` })
  current = next
  loadedAt = Date.now()
  applyCatalogOverrides(toOverrides(next))
  return { ok: true as const, before }
}

export async function audit(q: Queryable, actor: string, action: string, details: Record<string, unknown> = {}) {
  await q.query('insert into admin_audit (actor, action, details) values ($1, $2, $3)', [actor.slice(0, 80), action.slice(0, 80), JSON.stringify(details)])
}

/** The price each product (and variant) has now, and where it comes from, for /admin/setari and the API. */
export function priceTable() {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    soldOut: !!p.soldOut,
    overridden: p.id in current.prices,
    codePrice: PRICES_RON[p.id as keyof typeof PRICES_RON] ?? null,
    price: p.variablePrice ? null : p.price,
    variants: (p.variants ?? []).map((v) => ({ id: v.id, price: v.price ?? p.price })),
    variablePrice: !!p.variablePrice,
  }))
}

/**
 * The settings for one page render, read fresh and once (the layout and the page render in parallel; both await
 * this before reading a price, so the HTML and the browser script always carry the same numbers).
 */
export const settingsForRender = cache(() => ensureStoreSettings(0))
