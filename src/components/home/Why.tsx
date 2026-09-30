import Image from 'next/image'
import { why } from '@/content/home'

/** After the products, the reason to buy here: one photograph, three verified facts. */
export function Why() {
  return (
    <section aria-labelledby="why-title" className="wrap pt-[var(--sec)]">
      <div className="grid items-center gap-y-10 lg:grid-cols-12 lg:gap-x-12">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] lg:col-span-6 max-sm:-mx-[var(--gut)] max-sm:rounded-none">
          <Image src={why.image.src} alt={why.image.alt} fill placeholder="blur" sizes="(min-width: 1152px) 560px, (min-width: 1024px) 50vw, 100vw" className="object-cover object-[50%_40%]" />
        </div>
        <div className="lg:col-span-6">
          <h2 id="why-title" className="max-w-[13em] text-[clamp(32px,3.6vw,48px)] leading-[1.02] tracking-[-0.04em]">
            {why.title}
          </h2>
          <ol className="mt-8 space-y-6">
            {why.points.map((p, i) => (
              <li key={p.title} className="grid grid-cols-[40px_1fr] gap-x-4">
                <span aria-hidden className="pt-0.5 font-mono text-[13px] tracking-[0.08em] text-cyan-700">
                  0{i + 1}
                </span>
                <span>
                  <span className="block text-[20px] font-medium tracking-[-0.02em] text-ink">{p.title}</span>
                  <span className="mt-1 block max-w-[30em] text-[16px] leading-relaxed text-text">{p.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
