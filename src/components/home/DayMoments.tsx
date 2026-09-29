import Image from 'next/image'
import Link from 'next/link'
import { Arrow } from '@/components/ui/icons'
import { getProduct, productHref } from '@/content/catalog'
import { day, testimonials } from '@/content/home'

/**
 * Experiences: four ordinary moments of a day, each with the product that belongs to it, people in
 * frame. Written by us as uses, not as customer quotes. Verified customer words (content/home.ts,
 * `testimonials`) appear below the moments only when they exist.
 */
export function DayMoments() {
  return (
    <section aria-labelledby="day-title" className="on-dark mt-[var(--sec)] bg-dark py-[var(--sec)] text-white">
      <div className="wrap">
        <p className="text-[14px] font-semibold tracking-[0.12em] text-cyan uppercase">{day.kicker}</p>
        <div className="mt-3 grid gap-y-4 md:grid-cols-12 md:gap-x-6">
          <h2 id="day-title" className="text-[clamp(34px,4.4vw,60px)] leading-[1] tracking-[-0.045em] !text-white md:col-span-6">
            {day.title}
          </h2>
          <p className="max-w-[30em] self-end text-[18px] leading-relaxed text-white/80 md:col-span-5 md:col-start-8">{day.intro}</p>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-sm:mt-10">
          {day.moments.map((m, i) => {
            const p = getProduct(m.productId)!
            return (
              <li key={m.time}>
                <Link href={productHref(p)} className="group block">
                  <span className="relative block aspect-[3/4] overflow-hidden rounded-[20px] max-sm:aspect-[4/3]">
                    <Image
                      src={m.image.src}
                      alt={m.image.alt}
                      fill
                      placeholder="blur"
                      sizes="(min-width: 1152px) 270px, (min-width: 640px) 46vw, 100vw"
                      className={`object-cover transition-transform duration-500 ease-[var(--ease-brand)] group-hover:scale-[1.03] ${m.position ?? ''}`}
                    />
                    <span className="absolute top-4 left-4 rounded-full bg-dark/70 px-3 py-1 font-mono text-[12px] tracking-[0.08em] text-white backdrop-blur-sm">
                      0{i + 1} · {m.time}
                    </span>
                  </span>
                  <span className="mt-4 block text-[19px] leading-snug font-medium tracking-[-0.015em] text-white">{m.title}</span>
                  <span className="mt-1.5 block text-[15.5px] leading-relaxed text-dark-muted">{m.text}</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-medium text-cyan">
                    {p.name} <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>

        {testimonials.length > 0 && (
          <ul className="mt-14 grid gap-6 border-t border-dark-line pt-10 md:grid-cols-3">
            {testimonials.map((t) => (
              <li key={t.quote}>
                <blockquote className="text-[18px] leading-relaxed text-white">„{t.quote}”</blockquote>
                <p className="mt-3 text-[14.5px] text-dark-muted">
                  {t.name} · {getProduct(t.productId)!.name}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
