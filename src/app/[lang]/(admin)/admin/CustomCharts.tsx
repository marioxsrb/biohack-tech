'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

/** Mirrors server/series.ts (kept in sync by hand: a short list of names). */
const METRICS: Record<string, { label: string; unit: 'count' | 'lei' | 'percent'; by: string[] }> = {
  revenue: { label: 'Valoare comenzi (lei)', unit: 'lei', by: ['site', 'funnel', 'payment', 'source', 'product'] },
  orders: { label: 'Comenzi valide', unit: 'count', by: ['site', 'funnel', 'payment', 'source'] },
  sessions: { label: 'Vizite (sesiuni)', unit: 'count', by: ['site', 'funnel', 'source'] },
  views: { label: 'Afișări de pagini', unit: 'count', by: ['site', 'funnel', 'source'] },
  leads: { label: 'Leaduri', unit: 'count', by: ['site', 'funnel', 'source', 'product'] },
  units: { label: 'Bucăți vândute', unit: 'count', by: ['product', 'site'] },
  aov: { label: 'Coș mediu (lei)', unit: 'lei', by: ['site', 'payment'] },
  conversion: { label: 'Conversie (comenzi / sesiuni, %)', unit: 'percent', by: ['site'] },
  calls: { label: 'Apeluri AI', unit: 'count', by: ['outcome'] },
  welcome: { label: 'Înscrieri popup 10%', unit: 'count', by: [] },
  codes: { label: 'Comenzi cu cod promoțional', unit: 'count', by: ['code'] },
}
const BREAKDOWNS: Record<string, string> = { none: 'Fără împărțire', site: 'Pe site', funnel: 'Pe funnel', source: 'Pe sursă', payment: 'Pe metoda de plată', product: 'Pe produs', outcome: 'Pe rezultatul apelului', code: 'Pe cod' }
const DAYS = [7, 14, 30, 60, 90, 180, 365]

/** The validated categorical order (light surface); a series keeps its slot by order of size, never cycled. */
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']

export type ChartConfig = { metric: string; by: string; days: number; grain: 'day' | 'week'; kind: 'line' | 'bar' }
export type SavedChart = { id: string; title: string; config: ChartConfig }
type Series = { metric: string; label: string; unit: string; buckets: string[]; series: { key: string; label: string; values: number[] }[] }

const fmt = (v: number, unit: string) => (unit === 'lei' ? `${Math.round(v).toLocaleString('ro-RO')} lei` : unit === 'percent' ? `${v.toLocaleString('ro-RO')}%` : v.toLocaleString('ro-RO'))
const compact = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 1 })}K` : v.toLocaleString('ro-RO', { maximumFractionDigits: 1 }))
const day = (b: string) => `${b.slice(8, 10)}.${b.slice(5, 7)}`
const query = (c: ChartConfig) => `/api/admin/v1/series?metric=${c.metric}&by=${c.by}&days=${c.days}&grain=${c.grain}`
const additive = (metric: string) => metric !== 'aov' && metric !== 'conversion'

/** One chart: fetches its series, draws lines or stacked bars, a crosshair tooltip, a legend and a table view. */
function Chart({ config, title, onDelete }: { config: ChartConfig; title: string; onDelete?: () => void }) {
  // The last answer and the query it answered: while a new query loads, the previous chart stays (dimmed).
  const key = query(config)
  const [got, setGot] = useState<{ key: string; data: Series | null }>({ key: '', data: null })
  const data = got.data
  const loading = got.key !== key
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  // Drawn at the card's real width (fixed height), so text and marks keep their size on any screen.
  const boxRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.clientWidth))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let live = true
    fetch(key, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Series | null) => live && setGot((g) => ({ key, data: d ?? g.data })))
      .catch(() => live && setGot((g) => ({ key, data: g.data })))
    return () => {
      live = false
    }
  }, [key])

  const H = 220
  const pad = { l: 44, r: 12, t: 12, b: 26 }
  const kind = additive(config.metric) ? config.kind : 'line'
  const geo = useMemo(() => {
    if (!data) return null
    const n = data.buckets.length
    const totals = data.buckets.map((_, i) => data.series.reduce((s, x) => s + x.values[i], 0))
    const peak = kind === 'bar' ? Math.max(1, ...totals) : Math.max(1, ...data.series.flatMap((s) => s.values))
    const step = Math.pow(10, Math.floor(Math.log10(peak)))
    const max = Math.ceil(peak / step) * step
    const x = (i: number) => pad.l + (n <= 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (n - 1))
    const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b)
    const band = (W - pad.l - pad.r) / n
    return { n, max, x, y, band, ticks: [0, max / 2, max] }
  }, [data, kind, W, pad.b, pad.l, pad.r, pad.t])

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo || !svgRef.current) return
    const box = svgRef.current.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    const i = kind === 'bar' ? Math.floor((px - pad.l) / geo.band) : Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (geo.n - 1))
    setHover(i >= 0 && i < geo.n ? i : null)
  }

  return (
    <section className="rounded-[18px] bg-paper p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
          <p className="text-[12.5px] text-muted">
            {METRICS[config.metric]?.label} · {BREAKDOWNS[config.by]} · ultimele {config.days} zile · pe {config.grain === 'week' ? 'săptămâni' : 'zile'}
          </p>
        </div>
        <div className="flex gap-3 text-[13px]">
          <button type="button" onClick={() => setTable((t) => !t)} className="text-muted underline underline-offset-4 hover:text-ink">
            {table ? 'Grafic' : 'Tabel'}
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete} className="text-muted underline underline-offset-4 hover:text-red-deep">
              Șterge
            </button>
          )}
        </div>
      </div>

      {data && data.series.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-text">
          {data.series.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden className={kind === 'bar' ? 'h-2.5 w-2.5 rounded-[3px]' : 'h-[2px] w-3.5 rounded'} style={{ background: PALETTE[i] }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <div ref={boxRef} className={`relative transition-opacity ${loading && data ? 'opacity-50' : ''}`}>
        {!data && <div className="h-[220px] animate-pulse rounded-[12px] bg-mist" aria-busy="true" />}
        {data && geo && !table && (
          <>
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full touch-none select-none" role="img" aria-label={`${title}: grafic`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
              {geo.ticks.map((t) => (
                <g key={t}>
                  <line x1={pad.l} x2={W - pad.r} y1={geo.y(t)} y2={geo.y(t)} stroke="#e8edef" strokeWidth={1} />
                  <text x={pad.l - 6} y={geo.y(t) + 4} textAnchor="end" fontSize={11} fill="#8a969c">
                    {compact(t)}
                  </text>
                </g>
              ))}
              {data.buckets.map((b, i) =>
                geo.n <= 16 || i % Math.ceil(geo.n / 8) === 0 ? (
                  <text key={b} x={kind === 'bar' ? pad.l + geo.band * (i + 0.5) : geo.x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#8a969c">
                    {day(b)}
                  </text>
                ) : null,
              )}
              {kind === 'bar'
                ? data.buckets.map((b, i) => {
                    const w = Math.min(24, geo.band - 4)
                    const cx = pad.l + geo.band * (i + 0.5) - w / 2
                    let acc = 0
                    return (
                      <g key={b} opacity={hover === null || hover === i ? 1 : 0.55}>
                        {data.series.map((s, si) => {
                          const v = s.values[i]
                          if (!v) return null
                          const y0 = geo.y(acc)
                          acc += v
                          const y1 = geo.y(acc)
                          const top = si === data.series.length - 1 || data.series.slice(si + 1).every((x) => !x.values[i])
                          const h = Math.max(1, y0 - y1 - 2)
                          const t = y0 - h
                          // The data end (top) is rounded 4px, the baseline square; a 2px surface gap separates segments.
                          return top && h > 4 ? (
                            <path key={s.key} d={`M${cx},${y0} V${t + 4} Q${cx},${t} ${cx + 4},${t} H${cx + w - 4} Q${cx + w},${t} ${cx + w},${t + 4} V${y0} Z`} fill={PALETTE[si]} />
                          ) : (
                            <rect key={s.key} x={cx} y={t} width={w} height={h} fill={PALETTE[si]} />
                          )
                        })}
                      </g>
                    )
                  })
                : data.series.map((s, si) => (
                    <g key={s.key}>
                      {data.series.length === 1 && <path d={`M${geo.x(0)},${geo.y(0)} ${s.values.map((v, i) => `L${geo.x(i)},${geo.y(v)}`).join(' ')} L${geo.x(geo.n - 1)},${geo.y(0)} Z`} fill={PALETTE[si]} opacity={0.1} />}
                      <polyline points={s.values.map((v, i) => `${geo.x(i)},${geo.y(v)}`).join(' ')} fill="none" stroke={PALETTE[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                      {hover !== null && <circle cx={geo.x(hover)} cy={geo.y(s.values[hover])} r={4} fill={PALETTE[si]} stroke="#fff" strokeWidth={2} />}
                    </g>
                  ))}
              {hover !== null && kind === 'line' && <line x1={geo.x(hover)} x2={geo.x(hover)} y1={pad.t} y2={H - pad.b} stroke="#8a969c" strokeWidth={1} />}
            </svg>
            {hover !== null && (
              <div
                className="pointer-events-none absolute top-1 z-10 min-w-[150px] rounded-[10px] bg-ink px-3 py-2 text-[12.5px] text-white shadow-lg"
                style={{ left: `${Math.min(70, ((kind === 'bar' ? pad.l + geo.band * (hover + 0.5) : geo.x(hover)) / W) * 100)}%` }}
              >
                <p className="mb-1 text-white/70">{config.grain === 'week' ? `Săptămâna din ${day(data.buckets[hover])}` : day(data.buckets[hover])}</p>
                {data.series.map((s, si) => (
                  <p key={s.key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-white/80">
                      <span aria-hidden className="h-[2px] w-3 rounded" style={{ background: PALETTE[si] }} />
                      {s.label}
                    </span>
                    <b className="tabular-nums">{fmt(s.values[hover], data.unit)}</b>
                  </p>
                ))}
              </div>
            )}
          </>
        )}
        {data && table && (
          <div className="max-h-[260px] overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-paper">
                <tr className="text-left text-muted">
                  <th className="py-1 font-medium">{config.grain === 'week' ? 'Săptămâna' : 'Ziua'}</th>
                  {data.series.map((s) => (
                    <th key={s.key} className="py-1 text-right font-medium">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data.buckets.map((b, i) => (
                  <tr key={b} className="border-t border-mist-2">
                    <td className="py-1">{day(b)}</td>
                    {data.series.map((s) => (
                      <td key={s.key} className="py-1 text-right">
                        {fmt(s.values[i], data.unit)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

/** The builder (live preview) and the saved charts; saved in Supabase through the admin API. */
export function CustomCharts({ initial }: { initial: SavedChart[] }) {
  const [list, setList] = useState(initial)
  const [open, setOpen] = useState(initial.length === 0)
  const [title, setTitle] = useState('')
  const [cfg, setCfg] = useState<ChartConfig>({ metric: 'revenue', by: 'site', days: 30, grain: 'day', kind: 'bar' })
  const [busy, setBusy] = useState(false)
  const allowed = METRICS[cfg.metric].by
  const set = (patch: Partial<ChartConfig>) =>
    setCfg((c) => {
      const next = { ...c, ...patch }
      if (!['none', ...METRICS[next.metric].by].includes(next.by)) next.by = 'none'
      return next
    })

  async function save() {
    setBusy(true)
    const r = await fetch('/api/admin/v1/charts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...cfg, title: title || METRICS[cfg.metric].label }) })
    const d = await r.json().catch(() => null)
    setBusy(false)
    if (d?.chart) {
      setList((l) => [...l, { id: d.chart.id, title: title || METRICS[cfg.metric].label, config: d.chart.config }])
      setTitle('')
      setOpen(false)
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/v1/charts/${id}`, { method: 'DELETE' })
    setList((l) => l.filter((c) => c.id !== id))
  }

  const sel = 'field !min-h-10 !w-auto !py-1.5'
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Grafice personalizate</h2>
        <button type="button" onClick={() => setOpen((o) => !o)} className="btn-secondary sm">
          {open ? 'Închide' : '+ Grafic nou'}
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-[18px] bg-paper p-5">
          <div className="flex flex-wrap items-end gap-3 text-[14px]">
            <label className="grid gap-1">
              <span className="text-[12.5px] text-muted">Ce măsori</span>
              <select value={cfg.metric} onChange={(e) => set({ metric: e.target.value })} className={sel}>
                {Object.entries(METRICS).map(([k, m]) => (
                  <option key={k} value={k}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-[12.5px] text-muted">Împărțit</span>
              <select value={cfg.by} onChange={(e) => set({ by: e.target.value })} className={sel}>
                {['none', ...allowed].map((k) => (
                  <option key={k} value={k}>
                    {BREAKDOWNS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-[12.5px] text-muted">Perioada</span>
              <select value={cfg.days} onChange={(e) => set({ days: Number(e.target.value) })} className={sel}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    ultimele {d} zile
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-[12.5px] text-muted">Pas</span>
              <select value={cfg.grain} onChange={(e) => set({ grain: e.target.value as 'day' | 'week' })} className={sel}>
                <option value="day">pe zile</option>
                <option value="week">pe săptămâni</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-[12.5px] text-muted">Tip</span>
              <select value={cfg.kind} onChange={(e) => set({ kind: e.target.value as 'line' | 'bar' })} className={sel}>
                <option value="bar">bare</option>
                <option value="line">linie</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-[12.5px] text-muted">Titlu (opțional)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={METRICS[cfg.metric].label} className="field !min-h-10 !w-[220px] !py-1.5" />
            </label>
            <button type="button" onClick={save} disabled={busy} className="cta sm">
              {busy ? 'Se salvează…' : 'Salvează graficul'}
            </button>
          </div>
          <div className="mt-4">
            <Chart config={cfg} title={title || 'Previzualizare'} />
          </div>
        </div>
      )}

      {list.length > 0 && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {list.map((c) => (
            <Chart key={c.id} config={c.config} title={c.title} onDelete={() => remove(c.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
