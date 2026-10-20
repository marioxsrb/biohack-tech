/** Custom chart series: every day present, splits, the "Altele" fold, rates; saved charts. PGlite. */
import { describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { countVisit } = await import('@/server/leads')
const { buildSeries, parseSeriesQuery } = await import('@/server/series')
const { charts } = await import('@/server/charts')

describe('series', () => {
  it('days without data are zeros; split by site; orders by payment; conversion as a rate', async () => {
    const db = await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'none' })
    await countVisit(db, 'home', { session: true })
    await countVisit(db, 'calm', { session: true, site: 'calm' })
    // A visit counted on the former acces.<domain> (closed 20.10.2026) belongs to the main store.
    await db.query("insert into visit_stats (day, site, funnel, page, source, campaign, views, sessions) values ((now() at time zone 'Europe/Bucharest')::date, 'acces', 'gated_price', 'calm', '', '', 1, 1)")
    await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: 'cod' }, attemptId: 's1' })
    const visits = await buildSeries(db, parseSeriesQuery({ metric: 'sessions', by: 'site', days: 7 }))
    expect(visits.buckets).toHaveLength(7)
    expect(visits.series.map((s) => [s.label, s.values.at(-1)]).sort()).toEqual([['biohack-tech.ro', 2], ['calm.biohack-tech.ro', 1]])
    const pay = await buildSeries(db, parseSeriesQuery({ metric: 'orders', by: 'payment', days: 7 }))
    expect(pay.series).toEqual([{ key: 'cash_on_delivery', label: 'ramburs', values: [0, 0, 0, 0, 0, 0, 1] }])
    const rate = await buildSeries(db, parseSeriesQuery({ metric: 'conversion', by: 'none', days: 7 }))
    expect(rate.series[0].values.at(-1)).toBeCloseTo(33.3, 1)
    const weeks = await buildSeries(db, parseSeriesQuery({ metric: 'revenue', by: 'none', days: 30, grain: 'week' }))
    expect(weeks.buckets.length).toBeGreaterThanOrEqual(5)
    expect(weeks.series[0].values.reduce((s, v) => s + v, 0)).toBe(3337) // NEUROS Focus, 3.337 lei since 20.10.2026
  })

  it('unknown values fall back safely; a split the metric does not have is none', () => {
    expect(parseSeriesQuery({ metric: 'drop table', by: 'x', days: 3 })).toEqual({ metric: 'revenue', by: 'none', days: 30, grain: 'day' })
    expect(parseSeriesQuery({ metric: 'welcome', by: 'site', days: 7 })).toMatchObject({ by: 'none' })
  })

  it('saved charts: add, list, remove', async () => {
    const db = await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'none' })
    const c = await charts.add(db, 'Vânzări pe site', { metric: 'revenue', by: 'site', days: 30, kind: 'bar' })
    expect((await charts.list(db)).map((x) => x.title)).toEqual(['Vânzări pe site'])
    expect(await charts.remove(db, c.id)).toBe(true)
    expect(await charts.list(db)).toEqual([])
  })
})
