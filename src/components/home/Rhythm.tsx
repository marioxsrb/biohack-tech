import { Check } from '@/components/ui/icons'
import { rhythm } from '@/content/home'

/**
 * Before / with, as two columns of text: the same day without a habit (muted) and with one (strong).
 * Routines, not results: nothing here promises an outcome.
 */
export function Rhythm() {
  return (
    <section aria-labelledby="rhythm-title" className="wrap pt-[var(--sec)]">
      <h2 id="rhythm-title" className="text-[clamp(34px,4vw,54px)] leading-[1] tracking-[-0.045em]">
        {rhythm.title}
      </h2>
      <p className="mt-4 max-w-[34em] text-[18px] leading-relaxed text-text">{rhythm.intro}</p>

      <div className="mt-10 grid overflow-hidden rounded-[24px] md:grid-cols-2">
        <div className="bg-mist-2 p-[clamp(24px,3.2vw,40px)]">
          <p className="text-[13px] font-semibold tracking-[0.12em] text-[#4a575d] uppercase">{rhythm.before.label}</p>
          <ul className="mt-5 space-y-4">
            {rhythm.before.items.map((t) => (
              <li key={t} className="flex gap-3 text-[18px] leading-snug text-[#3a464b]">
                <span aria-hidden className="mt-[10px] h-1.5 w-1.5 flex-none rounded-full bg-[#7d8a90]" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="on-dark bg-dark p-[clamp(24px,3.2vw,40px)]">
          <p className="text-[13px] font-semibold tracking-[0.12em] text-cyan uppercase">{rhythm.after.label}</p>
          <ul className="mt-5 space-y-4">
            {rhythm.after.items.map((t) => (
              <li key={t} className="flex gap-3 text-[18px] leading-snug font-medium text-white">
                <Check className="mt-0.5 h-5 w-5 flex-none text-cyan" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-4 text-[14px] text-muted">{rhythm.note}</p>
    </section>
  )
}
