import Image from 'next/image'
import Link from 'next/link'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { Price } from '@/components/cart/Price'
import { PromoNote } from '@/components/cart/PromoNote'
import { Arrow } from '@/components/ui/icons'
import { getProduct, productHref, type Product, type ProductId } from '@/content/catalog'
import { terms } from '@/config/site'

/**
 * The one place the four products are introduced. An editorial, asymmetric shelf: a wide stage and a
 * narrow one per row, swapped on the second row, each product on its own quiet colour. Every tile says
 * when it is used, what it is, the price, the offer, and one next step.
 */
const SHELF: { id: ProductId; when: string; tint: string; wide: boolean }[] = [
  { id: 'balance-wave', when: 'Seara · relaxare', tint: '#f4e9e6', wide: true },
  { id: 'brainlink-pro', when: 'La birou · atenție', tint: '#e5f1f4', wide: false },
  { id: 'ochelari-biohack', when: 'La ecrane · zi și seară', tint: '#f5ecdc', wide: false },
  { id: 'brain-flow', when: 'Acasă · fotobiomodulare', tint: '#efedeb', wide: true },
]

export function Discover() {
  return (
    <section id="produse" aria-labelledby="produse-title" className="wrap scroll-mt-[calc(var(--nav-h)+16px)] pt-[calc(var(--sec)*0.8)]">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
        <h2 id="produse-title" className="max-w-[12em] text-[clamp(34px,4vw,54px)] leading-[1] tracking-[-0.045em]">
          Patru produse. Fiecare cu momentul lui.
        </h2>
        <p className="max-w-[26em] text-[17px] leading-relaxed text-text">Alege după momentul din zi în care vrei să îl folosești.</p>
      </div>

      <ul className="mt-10 grid gap-5 lg:grid-cols-12">
        {SHELF.map((s) => (
          <Tile key={s.id} p={getProduct(s.id)!} when={s.when} tint={s.tint} wide={s.wide} />
        ))}
      </ul>

      <ul className="mt-8 grid gap-x-6 gap-y-2 text-[15px] text-text sm:grid-cols-2 lg:flex lg:justify-between">
        <li>✓ Plată cu cardul sau prin transfer bancar</li>
        <li>✓ Livrare gratuită în România</li>
        <li>✓ {terms.returnDays} zile să te răzgândești</li>
        <li>✓ Garanție {terms.warrantyYears} ani</li>
      </ul>
    </section>
  )
}

function Tile({ p, when, tint, wide }: { p: Product; when: string; tint: string; wide: boolean }) {
  const choose = !!p.variants?.length
  const head = (
    <>
      <p className="text-[14px] font-semibold tracking-[0.01em] text-cyan-700">{when}</p>
      <h3 className="mt-2 text-[clamp(30px,2.8vw,38px)] leading-[1] tracking-[-0.04em] whitespace-nowrap">
        <Link href={productHref(p)} className="after:absolute after:inset-0 after:content-[''] hover:underline hover:decoration-1 hover:underline-offset-4">
          {p.name}
        </Link>
      </h3>
      <p className="mt-2 max-w-[22em] text-[15.5px] leading-snug text-text">{p.kind}</p>
    </>
  )
  const buy = (
    <div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[22px] font-medium tracking-[-0.02em] text-ink tabular-nums">
          <Price productId={p.id} />
        </span>
        <PromoNote productId={p.id} />
      </p>
      {/* Above the tile-wide link, so the buttons act on their own. */}
      <div className="relative z-20 mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {choose ? (
          <Link href={`${productHref(p)}#cumpara`} className="cta sm">
            {p.chooseLabel} <Arrow />
          </Link>
        ) : (
          <AddToCartButton productId={p.id} size="sm" />
        )}
        <Link href={productHref(p)} className="text-[14.5px] font-medium text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
          Detalii
        </Link>
      </div>
    </div>
  )
  const image = (
    <Image
      src={p.cutout.src}
      alt={p.cutout.alt}
      fill
      sizes={wide ? '(min-width: 1152px) 360px, (min-width: 640px) 50vw, 90vw' : '(min-width: 1152px) 440px, 90vw'}
      className={`object-contain transition-transform duration-500 ease-[var(--ease-brand)] group-hover:scale-[1.04] ${p.cutout.bleed === 'bottom' ? 'object-bottom' : ''}`}
    />
  )
  const pad = 'p-[clamp(22px,2.6vw,36px)]'
  // Wide: text and price on the left, the product large on the right. Narrow: text, product, price.
  // Either way the price and the action sit on the tile's lower edge, so rows line up.
  return (
    <li style={{ background: tint }} className={`group relative overflow-hidden rounded-[28px] ${wide ? 'lg:col-span-7' : 'lg:col-span-5'}`}>
      {wide ? (
        <div className="grid h-full sm:grid-cols-2">
          <div className={`relative z-10 flex flex-col ${pad}`}>
            {head}
            <div className="mt-auto pt-6 sm:pt-8">{buy}</div>
          </div>
          <div className={`relative min-h-[190px] sm:min-h-[260px] ${p.cutout.bleed === 'bottom' ? 'mx-[6%] mt-[6%]' : 'm-[8%]'}`}>{image}</div>
        </div>
      ) : (
        <div className={`flex h-full flex-col ${pad}`}>
          <div className="relative z-10">{head}</div>
          <div className="relative my-4 min-h-[170px] flex-1 sm:my-6 sm:min-h-[200px]">{image}</div>
          <div className="relative z-10">{buy}</div>
        </div>
      )}
    </li>
  )
}
