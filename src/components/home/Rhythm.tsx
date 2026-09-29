import { rhythm } from '@/content/home'

/**
 * "Aceeași zi. Alt ritm.": four moments of the same day, read across. Left, the day as it happens (quiet
 * type); right, the same moment with a deliberate tool (strong type on dark). Typography, no icons.
 */
export function Rhythm() {
  return (
    <section aria-labelledby="rhythm-title" className="wrap pt-[var(--sec)]">
      <h2 id="rhythm-title" className="text-[clamp(34px,4vw,54px)] leading-[1] tracking-[-0.045em]">
        {rhythm.title}
      </h2>
      <p className="mt-4 max-w-[34em] text-[18px] leading-relaxed text-text">{rhythm.intro}</p>

      {/* Phones: the two column names once, as a legend. */}
      <p className="mt-8 flex flex-wrap gap-2 text-[13px] font-semibold tracking-[0.08em] uppercase md:hidden">
        <span className="rounded-full bg-paper px-3 py-1.5 text-muted">{rhythm.without}</span>
        <span className="rounded-full bg-dark px-3 py-1.5 text-cyan">{rhythm.with}</span>
      </p>
      <div className="mt-4 overflow-hidden rounded-[28px] bg-paper md:mt-10">
        <div className="grid md:grid-cols-[150px_1fr_1fr]">
          <span className="hidden md:block" />
          <p className="px-6 pt-6 pb-3 text-[13px] font-semibold tracking-[0.12em] text-muted uppercase max-md:hidden md:px-8">{rhythm.without}</p>
          <p className="bg-dark px-6 pt-6 pb-3 text-[13px] font-semibold tracking-[0.12em] text-cyan uppercase max-md:hidden md:px-8">{rhythm.with}</p>
          {rhythm.rows.map((r, i) => (
            <div key={r.moment} className="contents">
              <p className={`px-6 pt-6 text-[15px] font-semibold text-ink md:px-8 md:py-6 ${i ? 'md:border-t md:border-mist-2' : ''}`}>{r.moment}</p>
              <p className={`px-6 pt-1 pb-3 text-[17px] leading-snug text-[#5d6a70] md:px-8 md:py-6 ${i ? 'md:border-t md:border-mist-2' : ''}`}>
                {r.without}
              </p>
              <p className={`on-dark bg-dark px-6 py-4 text-[17px] leading-snug font-medium text-white md:px-8 md:py-6 max-md:mx-6 max-md:rounded-[14px] ${i ? 'md:border-t md:border-white/10' : ''} ${i === rhythm.rows.length - 1 ? 'max-md:mb-6' : ''}`}>
                {r.with}
              </p>
            </div>
          ))}
          <span className="hidden h-6 md:block" />
          <span className="hidden h-6 md:block" />
          <span className="hidden h-6 bg-dark md:block" />
        </div>
      </div>
      <p className="mt-4 text-[14px] text-muted">{rhythm.note}</p>
    </section>
  )
}
