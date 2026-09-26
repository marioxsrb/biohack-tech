import Image from 'next/image'
import Link from 'next/link'
import { Arrow } from '@/components/ui/icons'
import { Price } from '@/components/cart/Price'
import { productHref, products } from '@/content/catalog'

/**
 * The three products, straight after the photograph. The panels rise over the hero's lower
 * edge (a static overlap, no scroll code), the middle one set lower for rhythm. Hovering a
 * panel lifts its product and moves the arrow; Calm's red light brightens.
 */
export function Discover() {
  return (
    <section id="produse" aria-label="Produse" className="relative z-10 -mt-[132px] scroll-mt-[calc(var(--nav-h)+16px)] max-md:-mt-[88px]">
      <ul className="wrap grid gap-5 md:grid-cols-3 md:gap-6">
        {products.map((p, i) => (
          <li key={p.id} className={i === 1 ? 'md:mt-16' : ''}>
            <Link
              href={productHref(p)}
              className="group relative flex h-full flex-col overflow-hidden rounded-[20px] bg-paper p-6 shadow-[0_30px_60px_-40px_rgba(8,17,19,.45)] transition-shadow duration-300 hover:shadow-[0_36px_70px_-36px_rgba(8,17,19,.5)] md:p-7"
            >
              <span className="flex items-baseline justify-between">
                <span className="text-[15px] font-medium text-cyan-700">{p.purpose}</span>
                <span className="font-mono text-[12px] tracking-[0.12em] text-muted">0{i + 1}</span>
              </span>
              <span className="mt-3 block">
                <span className="block text-[13px] font-semibold tracking-[0.18em] text-muted">{p.brand}</span>
                <span className="block text-[clamp(44px,4.6vw,68px)] leading-[0.95] font-medium tracking-[-0.05em] text-ink">{p.model}</span>
              </span>

              <span className="relative mt-auto block aspect-[4/3] pt-4">
                {p.id === 'balance-wave' && (
                  <span aria-hidden className="glow absolute inset-0 bg-[radial-gradient(closest-side,rgb(230_69_69/.22),transparent)] opacity-60" />
                )}
                <span aria-hidden className="shade absolute bottom-[4%] left-[18%] h-5 w-[64%] rounded-[50%]" />
                <span className="lift absolute inset-0">
                  <Image
                    src={p.cutout.src}
                    alt={p.cutout.alt}
                    fill
                    sizes="(min-width: 1152px) 340px, (min-width: 768px) 30vw, 90vw"
                    className={`object-contain ${p.cutout.bleed === 'bottom' ? 'object-bottom' : ''}`}
                  />
                </span>
              </span>

              <span className="flex items-center justify-between border-t border-line pt-4">
                <span className="text-[18px] font-medium tracking-[-0.015em] text-ink tabular-nums">
                  <Price productId={p.id} />
                </span>
                <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
                  Vezi produsul <Arrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
