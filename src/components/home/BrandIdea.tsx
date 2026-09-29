import Image from 'next/image'
import Link from 'next/link'
import { Arrow } from '@/components/ui/icons'
import { getProduct, productHref, type ProductId } from '@/content/catalog'
import { terms } from '@/config/site'
import calm from '@/assets/img/balance-wave/result-somn.webp'
import focus from '@/assets/img/brainlink/pillar-games.webp'
import amber from '@/assets/img/glasses/result-stil.webp'
import brainFlow from '@/assets/img/brain-flow/lifestyle-femeie.webp'

const moments: { id: ProductId; image: typeof calm; alt: string; line: string; position: string }[] = [
  { id: 'balance-wave', image: calm, alt: 'Femeie în pat, seara, purtând NEUROS Calm', line: 'Seara, înainte de somn.', position: 'object-[42%_50%]' },
  { id: 'brainlink-pro', image: focus, alt: 'Tânăr pe canapea, purtând NEUROS Focus și jucând pe tabletă', line: 'Jocuri pe tabletă, cu atenția.', position: 'object-[70%_50%]' },
  { id: 'ochelari-biohack', image: amber, alt: 'Femeie purtând NEUROS Amber cat eye bej', line: 'La birou și seara, la ecrane.', position: 'object-[55%_40%]' },
  { id: 'brain-flow', image: brainFlow, alt: 'Femeie relaxată pe canapea, purtând casca Brain Flow', line: 'Acasă, după protocolul tău.', position: 'object-[78%_40%]' },
]

/** What Biohack Tech is, in two sentences, then the four products in real life, with people. */
export function BrandIdea() {
  return (
    <section aria-labelledby="brand-title" className="pt-[var(--sec)]">
      <div className="wrap">
        <div className="grid gap-y-5 md:grid-cols-12 md:gap-x-6">
          <h2 id="brand-title" className="text-[clamp(34px,4.4vw,60px)] leading-[1] tracking-[-0.045em] md:col-span-6">
            Pentru minte și corp, în fiecare zi.
          </h2>
          <p className="max-w-[30em] self-end text-[18px] leading-relaxed text-text md:col-span-5 md:col-start-8">
            Patru produse pentru relaxare, atenție, ecrane și rutina de acasă. Biohack Tech le aduce în România, cu livrare gratuită și un specialist care te ajută la început.
          </p>
        </div>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 max-sm:mt-10">
          {moments.map((m) => {
            const p = getProduct(m.id)!
            return (
              <li key={m.id}>
                <Link href={productHref(p)} className="group block">
                  <span className="relative block aspect-[4/5] overflow-hidden rounded-[20px] max-sm:aspect-[4/3]">
                    <Image src={m.image} alt={m.alt} fill placeholder="blur" sizes="(min-width: 1152px) 270px, (min-width: 640px) 46vw, 100vw" className={`object-cover transition-transform duration-500 ease-[var(--ease-brand)] group-hover:scale-[1.03] ${m.position}`} />
                  </span>
                  <span className="mt-4 flex items-baseline justify-between gap-3">
                    <span className="text-[20px] font-medium tracking-[-0.02em] text-ink">{p.name}</span>
                    <Arrow className="h-4 w-4 flex-none text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink" />
                  </span>
                  <span className="mt-0.5 block text-[15.5px] text-muted">{m.line}</span>
                </Link>
              </li>
            )
          })}
        </ul>

        <ul className="mt-14 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-8 text-[15.5px] text-text sm:grid-cols-4 max-sm:mt-10">
          <li>✓ Livrare gratuită în România</li>
          <li>✓ Retur în {terms.returnDays} zile</li>
          <li>✓ Garanție {terms.warrantyYears} ani</li>
          <li>✓ Răspuns în 24 de ore</li>
        </ul>
      </div>
    </section>
  )
}
