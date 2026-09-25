import Image from 'next/image'
import Link from 'next/link'
import { Arrow } from '@/components/ui/icons'
import { productHref, products, type Product } from '@/content/catalog'
import { formatMoney } from '@/lib/money'

/**
 * The three products as an edge-to-edge mosaic: the lead product on a wide panel,
 * the other two side by side. Hairline seams of white separate the panels.
 * Each panel carries only what a first-time visitor needs: name, one sentence, price.
 */
export function ProductShowcase({ title = 'Trei produse. Atât.', headingLevel = 2 }: { title?: string; headingLevel?: 1 | 2 }) {
  const [lead, ...rest] = products
  const H = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section id="produse" aria-labelledby="produse-title" className="scroll-mt-[var(--nav-h)]">
      <div className="wrap pt-[var(--sec)] pb-14 max-sm:pb-10">
        <H id="produse-title" className="rev text-[clamp(34px,4.4vw,64px)] leading-[1] tracking-[-0.04em]">
          {title}
        </H>
      </div>

      <div className="grid gap-[2px]">
        <LeadPanel product={lead} />
        <div className="grid gap-[2px] md:grid-cols-2">
          {rest.map((p) => (
            <Panel key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Shot({ product, sizes, className }: { product: Product; sizes: string; className: string }) {
  const img = product.cutout
  return (
    <div className={`relative ${className}`}>
      <Image
        src={img.src}
        alt={img.alt}
        fill
        sizes={sizes}
        data-kind={img.kind}
        className={`object-contain transition-transform duration-700 ease-[var(--ease-brand)] group-hover:scale-[1.04] ${
          img.kind === 'studio' ? 'mix-blend-multiply' : ''
        }`}
      />
    </div>
  )
}

function Meta({ product, large }: { product: Product; large?: boolean }) {
  return (
    <>
      <p className="text-[15px] text-muted">{product.purpose}</p>
      <h3 className={`mt-2 tracking-[-0.04em] ${large ? 'text-[clamp(40px,4.4vw,64px)] leading-[0.98]' : 'text-[clamp(32px,3vw,44px)] leading-[1]'}`}>
        {product.name}
      </h3>
      <p className={`mt-4 max-w-[26em] text-text ${large ? 'text-[18px]' : 'text-[16.5px]'}`}>{product.tagline}</p>
      <p className="mt-6 flex items-center gap-5 max-sm:mt-5">
        <span className="text-[19px] font-medium tracking-[-0.015em] text-ink tabular-nums">{formatMoney(product.price)}</span>
        <span className="inline-flex items-center gap-2 font-semibold text-ink underline decoration-transparent underline-offset-[6px] transition-colors group-hover:decoration-cyan">
          Vezi produsul <Arrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </p>
    </>
  )
}

function LeadPanel({ product }: { product: Product }) {
  // The source cutout's cable is cropped at the bottom, so the product sits on the panel's
  // lower edge and the cable runs off it, instead of ending mid-air.
  return (
    <Link href={productHref(product)} className="group block overflow-hidden bg-mist">
      <div className="wrap grid grid-cols-1 md:min-h-[min(680px,80svh)] md:grid-cols-12 md:gap-x-6">
        <div className="rev order-2 self-end md:order-1 md:col-span-7 md:pt-16">
          <Shot
            product={product}
            sizes="(min-width: 1152px) 700px, (min-width: 768px) 60vw, 90vw"
            className="aspect-[631/478] w-full [&_img]:origin-bottom [&_img]:object-bottom max-md:mx-auto max-md:w-[88%]"
          />
        </div>
        <div className="rev order-1 self-center pt-14 pb-10 md:order-2 md:col-span-5 md:col-start-8 md:py-16">
          <Meta product={product} large />
        </div>
      </div>
    </Link>
  )
}

function Panel({ product }: { product: Product }) {
  return (
    <Link href={productHref(product)} className="group flex flex-col bg-mist px-[var(--gut)] pt-14 pb-14 md:px-[max(var(--gut),calc((100vw-1152px)/2+var(--gut)))] md:odd:pr-10 md:even:pl-10 max-md:pt-10 max-md:pb-12">
      <Shot product={product} sizes="(min-width: 768px) 45vw, 90vw" className="rev aspect-[4/3] w-full max-md:-mx-2" />
      <div className="rev mt-8">
        <Meta product={product} />
      </div>
    </Link>
  )
}
