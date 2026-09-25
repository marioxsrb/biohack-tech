import Image from 'next/image'
import Link from 'next/link'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { Faq } from '@/components/ui/Faq'
import { Arrow, External } from '@/components/ui/icons'
import { productHref, type Product } from '@/content/catalog'
import type { ProductContent } from '@/content/product-content'
import { formatMoney } from '@/lib/money'

type Props = { product: Product; content: ProductContent; scene?: React.ReactNode }

/**
 * Below the buy area: large pictures with a line or two each, how it's used,
 * one plain explanation of the technology, the details, and a way to buy again.
 */
export function ProductSections({ product, content: c, scene }: Props) {
  const [first, ...rest] = c.stories
  return (
    <>
      {scene}
      <Cinematic story={first} />
      {rest.length > 0 && (
        <div className="py-[calc(var(--sec)*0.5)]">
          {rest.map((s, i) => (
            <Story key={s.title} story={s} flip={i % 2 === 0} />
          ))}
        </div>
      )}
      {c.steps && <Steps steps={c.steps} />}
      {c.detail && <Detail detail={c.detail} />}
      <Details content={c} />
      <BuyAgain product={product} />
    </>
  )
}

/** The first story fills the screen: photograph edge to edge, headline set into its darkest corner. */
function Cinematic({ story }: { story: ProductContent['stories'][number] }) {
  return (
    <section className="relative isolate flex min-h-[560px] h-[88svh] items-end overflow-hidden text-white">
      <Image src={story.image.src} alt={story.image.alt} fill placeholder="blur" sizes="100vw" className="-z-10 object-cover" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[60%] bg-[linear-gradient(0deg,rgba(8,17,19,.78),rgba(8,17,19,0))]" />
      <div className="wrap w-full pb-[clamp(40px,8vh,88px)]">
        <h2 className="rev max-w-[12em] text-[clamp(36px,5vw,72px)] leading-[0.98] tracking-[-0.045em] !text-white">{story.title}</h2>
        <p className="rev mt-4 max-w-[30em] text-[17px] leading-relaxed text-white/85">{story.text}</p>
      </div>
    </section>
  )
}

const bleedLeft = 'md:-ml-[calc((100vw-min(100vw,1152px))/2+var(--gut))]'
const bleedRight = 'md:-mr-[calc((100vw-min(100vw,1152px))/2+var(--gut))]'

/** A photograph that runs to the edge of the screen, with a headline and one or two sentences beside it. */
function Story({ story, flip }: { story: ProductContent['stories'][number]; flip: boolean }) {
  return (
    <section className="overflow-hidden py-[calc(var(--sec)*0.5)]">
      <div className="wrap grid grid-cols-1 items-center gap-y-8 md:grid-cols-12 md:gap-x-6">
        <div
          className={`rev relative aspect-[4/3] md:col-span-7 max-md:-mx-[var(--gut)] ${flip ? `md:order-2 md:col-start-6 ${bleedRight}` : bleedLeft}`}
        >
          <Image src={story.image.src} alt={story.image.alt} fill placeholder="blur" sizes="(min-width: 768px) 62vw, 100vw" className="object-cover" />
        </div>
        <div className={`rev md:col-span-4 ${flip ? 'md:order-1 md:col-start-1' : 'md:col-start-9'}`}>
          <h2 className="text-[clamp(30px,3.2vw,46px)] leading-[1.03] tracking-[-0.04em]">{story.title}</h2>
          <p className="mt-5 text-[18px] leading-relaxed text-text">{story.text}</p>
        </div>
      </div>
    </section>
  )
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <section aria-labelledby="steps-title" className="mt-[calc(var(--sec)*0.5)] bg-dark py-[var(--sec)] text-white">
      <div className="wrap">
        <h2 id="steps-title" className="rev text-[clamp(30px,3.2vw,46px)] leading-none tracking-[-0.04em] !text-white">
          Cum îl folosești
        </h2>
        <ol className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6 max-sm:mt-8 max-sm:gap-6">
          {steps.map((s, i) => (
            <li key={s} className="rev max-sm:flex max-sm:items-baseline max-sm:gap-5">
              <span className="block w-8 flex-none text-[clamp(44px,6vw,88px)] leading-none font-light tracking-[-0.04em] text-cyan">{i + 1}</span>
              <p className="mt-4 max-w-[14em] text-[20px] leading-snug tracking-[-0.015em] text-white max-sm:mt-0">{s}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** The technology, once, in plain words. */
function Detail({ detail }: { detail: NonNullable<ProductContent['detail']> }) {
  return (
    <section aria-labelledby="detail-title" className="bg-mist py-[var(--sec)]">
      <div className="wrap grid grid-cols-1 items-center gap-y-10 md:grid-cols-12 md:gap-x-6">
        <div className="rev relative aspect-[4/3] md:col-span-6 max-md:-mx-[var(--gut)]">
          <Image src={detail.image.src} alt={detail.image.alt} fill placeholder="blur" sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </div>
        <div className="rev md:col-span-5 md:col-start-8">
          <h2 id="detail-title" className="text-[clamp(30px,3.2vw,46px)] leading-[1.03] tracking-[-0.04em]">
            {detail.title}
          </h2>
          <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-text">
            {detail.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {detail.studies && (
            <details className="faq group mt-4">
              <summary className="tlink cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                Vezi studiile <Arrow className="transition-transform duration-200 group-open:rotate-90" />
              </summary>
              <div className="faq-body">
                <ul className="pb-1">
                  {detail.studies.map((s) => (
                    <li key={s.href}>
                      <a href={s.href} target="_blank" rel="noopener noreferrer" className="group/l inline-flex items-center gap-2 py-2 text-[15px] text-text hover:text-ink">
                        <External className="h-4 w-4 flex-none text-muted group-hover/l:text-cyan-700" />
                        <span className="underline decoration-line underline-offset-4">{s.label}</span>
                        <span className="sr-only"> (se deschide într-o filă nouă)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  )
}

/** Specifications and a short FAQ, side by side: reference material, set quietly. */
function Details({ content: c }: { content: ProductContent }) {
  return (
    <section aria-labelledby="specs-title" className="py-[var(--sec)]">
      <div className="wrap grid grid-cols-1 gap-y-16 md:grid-cols-12 md:gap-x-6">
        <div className="md:col-span-5">
          <h2 id="specs-title" className="text-[26px] tracking-[-0.03em]">
            Detalii
          </h2>
          <dl className="mt-6">
            {c.specs.map((s) => (
              <div key={s.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 border-t border-mist-2 py-3.5 text-[15.5px] last:border-b">
                <dt className="text-muted">{s.label}</dt>
                <dd className="text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="md:col-span-6 md:col-start-7">
          <h2 className="text-[26px] tracking-[-0.03em]">Întrebări</h2>
          <div className="mt-6">
            <Faq items={c.faqs} />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Closing purchase: the product, large, with its price and one button. */
function BuyAgain({ product }: { product: Product }) {
  const img = product.cutout
  const bleed = img.bleed === 'bottom'
  return (
    <section id="buy-again" aria-label={`Cumpără ${product.name}`} className="overflow-hidden bg-mist">
      <div className="wrap grid grid-cols-1 md:grid-cols-12 md:gap-x-6">
        <div className={`relative aspect-[16/10] md:col-span-6 ${bleed ? 'order-2 self-end md:order-1 md:mt-16' : 'my-12 md:my-16'}`}>
          <Image
            src={img.src}
            alt={img.alt}
            fill
            sizes="(min-width: 768px) 50vw, 90vw"
            data-kind={img.kind}
            className={`object-contain ${bleed ? 'object-bottom' : ''} ${img.kind === 'studio' ? 'mix-blend-multiply' : ''}`}
          />
        </div>
        <div className={`self-center md:col-span-5 md:col-start-8 ${bleed ? 'order-1 pt-12 pb-8 md:order-2 md:py-16' : 'pb-12 md:py-16'}`}>
          <p className="text-[clamp(32px,3.4vw,48px)] leading-none font-medium tracking-[-0.04em] text-ink">{product.name}</p>
          <p className="mt-3 text-[19px] text-ink tabular-nums">{formatMoney(product.price)}</p>
          <div className="mt-7">
            {product.variants ? (
              <Link href={`${productHref(product)}#cumpara`} className="cta">
                Alege modelul <Arrow />
              </Link>
            ) : (
              <AddToCartButton productId={product.id} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
