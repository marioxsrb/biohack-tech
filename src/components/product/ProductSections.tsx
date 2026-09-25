import Image from 'next/image'
import Link from 'next/link'
import { ProductShot } from '@/components/product/ProductShot'
import { Faq } from '@/components/ui/Faq'
import { Idx } from '@/components/ui/Idx'
import { Arrow, External } from '@/components/ui/icons'
import { productHref, products, type Product } from '@/content/catalog'
import type { ProductContent } from '@/content/product-content'
import { formatMoney } from '@/lib/money'

type Props = { product: Product; content: ProductContent }

/**
 * Everything below the buy box. Sections render only when the source material has
 * content for them, so no product shows empty ecommerce boilerplate.
 */
export function ProductSections({ product, content: c }: Props) {
  let n = 0
  const next = () => String(++n).padStart(2, '0')

  return (
    <>
      <Overview n={next()} product={product} content={c} />
      <Audience n={next()} content={c} />
      {c.explainer && <Explainer n={next()} content={c} />}
      {c.steps && <Steps n={next()} content={c} />}
      <Results n={next()} content={c} />
      {c.studies && <Studies n={next()} content={c} />}
      <ProductFaq n={next()} product={product} content={c} />
      <Related current={product} />
    </>
  )
}

function SectionHead({ n, label, title, id, aside, dark }: { n: string; label: string; title: string; id: string; aside?: string; dark?: boolean }) {
  return (
    <header className="grid items-end gap-y-4 md:grid-cols-12 md:gap-x-6">
      <div className="md:col-span-7">
        <Idx n={n}>{label}</Idx>
        <h2 id={id} className={`h2 rev ${dark ? '!text-white' : ''}`}>
          {title}
        </h2>
      </div>
      {aside && <p className={`sub rev md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-9 ${dark ? '!text-dark-muted' : ''}`}>{aside}</p>}
    </header>
  )
}

function Overview({ n, product, content: c }: { n: string } & Props) {
  return (
    <section id="despre" className="sec" aria-labelledby="despre-title">
      <div className="wrap grid gap-y-10 md:grid-cols-12 md:gap-x-6">
        <div className="md:col-span-5">
          <Idx n={n}>Despre produs</Idx>
          <h2 id="despre-title" className="h2 rev">
            {c.overviewHeading}
          </h2>
          <p className="rev mt-5 text-[17px] leading-relaxed text-text">{c.about}</p>
        </div>
        <div className="rev md:col-span-6 md:col-start-7 lg:col-span-6 lg:col-start-7">
          <h3 id="specificatii" className="h3 scroll-mt-24">Specificații</h3>
          <dl className="mt-4 border-t border-line">
            {c.specs.map((s) => (
              <div key={s.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 border-b border-mist-2 py-3.5 text-[15.5px]">
                <dt className="text-muted">{s.label}</dt>
                <dd className="text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {c.specImage && (
        <figure className="wrap rev mt-16 max-md:mt-10">
          <div className="overflow-hidden rounded-[24px] bg-mist max-sm:-mx-[var(--gut)] max-sm:rounded-none">
            <Image
              src={c.specImage.src}
              alt={c.specImage.alt}
              sizes="(min-width: 1152px) 1104px, 100vw"
              placeholder="blur"
              className="w-full mix-blend-multiply"
            />
          </div>
          <figcaption className="mono mt-3 !text-[11px]">{product.name}, componentele</figcaption>
        </figure>
      )}
    </section>
  )
}

/** Three editorial images. On phones they become a swipeable rail instead of a long stack. */
function Audience({ n, content: c }: { n: string; content: ProductContent }) {
  return (
    <section className="sec bg-mist" aria-labelledby="audience-title">
      <div className="wrap">
        <SectionHead n={n} label="Pentru cine" title={c.audience.heading} id="audience-title" />
        <ul className="rev mt-12 grid gap-6 max-md:mt-8 max-sm:-mr-[var(--gut)] max-sm:flex max-sm:snap-x max-sm:snap-mandatory max-sm:gap-3 max-sm:overflow-x-auto max-sm:pr-[var(--gut)] max-sm:[scrollbar-width:none] sm:grid-cols-3">
          {c.audience.items.map((it) => (
            <li key={it.title} className="max-sm:w-[78%] max-sm:flex-none max-sm:snap-start">
              {it.image && (
                <div className="relative aspect-[4/3] overflow-hidden rounded-[16px]">
                  <Image src={it.image.src} alt={it.image.alt} fill sizes="(min-width: 1152px) 360px, (min-width: 640px) 32vw, 78vw" placeholder="blur" className="object-cover" />
                </div>
              )}
              <h3 className="h3 mt-5">{it.title}</h3>
              <p className="mt-1.5 text-[15.5px] text-muted">{it.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** Sticky explanation on the left, supporting images on the right. */
function Explainer({ n, content: c }: { n: string; content: ProductContent }) {
  const ex = c.explainer!
  const withImage = ex.items.filter((i) => i.image)
  const textOnly = ex.items.filter((i) => !i.image)
  return (
    <section className="sec" aria-labelledby="explainer-title">
      <div className="wrap grid gap-y-10 md:grid-cols-12 md:gap-x-6">
        <div className="md:col-span-5">
          <div className="md:sticky md:top-[calc(var(--nav-h)+40px)]">
            <Idx n={n}>Cum funcționează</Idx>
            <h2 id="explainer-title" className="h2 rev">
              {ex.heading}
            </h2>
            {ex.intro && <p className="rev mt-5 text-[17px] leading-relaxed">{ex.intro}</p>}
            {textOnly.length > 0 && (
              <ul className="rev mt-8 border-t border-mist-2">
                {textOnly.map((it) => (
                  <li key={it.title} className="border-b border-mist-2 py-4">
                    <h3 className="h3">{it.title}</h3>
                    <p className="mt-1 text-[15.5px] text-muted">{it.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="space-y-12 md:col-span-6 md:col-start-7 max-md:space-y-10">
          {withImage.map((it) => (
            <article key={it.title} className="rev">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] max-sm:rounded-[16px]">
                <Image src={it.image!.src} alt={it.image!.alt} fill sizes="(min-width: 1152px) 560px, (min-width: 768px) 50vw, 100vw" placeholder="blur" className="object-cover" />
              </div>
              <h3 className="mt-5 text-[21px] tracking-[-0.02em]">{it.title}</h3>
              <p className="mt-1.5 max-w-[34em] text-muted">{it.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Steps({ n, content: c }: { n: string; content: ProductContent }) {
  const s = c.steps!
  return (
    <section className="sec on-dark bg-dark text-white" aria-labelledby="steps-title">
      <div className="wrap">
        <SectionHead n={n} label="Cum îl folosești" title={s.heading} id="steps-title" dark />
        <ol className={`mt-14 grid gap-x-6 gap-y-8 max-md:mt-10 sm:grid-cols-2 ${s.items.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {s.items.map((it, i) => (
            <li key={it.title} className="rev border-t border-dark-line pt-5">
              <span className="font-mono text-[12px] tracking-[0.08em] text-cyan">0{i + 1}</span>
              <h3 className="mt-3 text-[19px] !text-white">{it.title}</h3>
              <p className="mt-2 text-[15.5px] text-dark-muted">{it.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** One large image and two smaller rows: breaks the three-column rhythm used above. */
function Results({ n, content: c }: { n: string; content: ProductContent }) {
  const [first, ...rest] = c.results.items
  return (
    <section className="sec" aria-labelledby="results-title">
      <div className="wrap">
        <SectionHead n={n} label="Rezultate" title={c.results.heading} id="results-title" />
        <div className="mt-12 grid gap-y-10 max-md:mt-8 md:grid-cols-12 md:gap-x-6">
          <article className="rev md:col-span-7">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] max-sm:-mx-[var(--gut)] max-sm:rounded-none">
              <Image src={first.image!.src} alt={first.image!.alt} fill sizes="(min-width: 1152px) 660px, (min-width: 768px) 58vw, 100vw" placeholder="blur" className="object-cover" />
            </div>
            <h3 className="mt-5 text-[21px] tracking-[-0.02em]">{first.title}</h3>
            <p className="mt-1.5 max-w-[34em] text-muted">{first.text}</p>
          </article>
          <div className="flex flex-col gap-8 md:col-span-5">
            {rest.map((it) => (
              <article key={it.title} className="rev grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-center gap-5 md:grid-cols-1 md:items-start md:gap-0">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] md:aspect-[16/10]">
                  <Image src={it.image!.src} alt={it.image!.alt} fill sizes="(min-width: 1152px) 440px, (min-width: 768px) 40vw, 45vw" placeholder="blur" className="object-cover" />
                </div>
                <div className="md:mt-4">
                  <h3 className="h3">{it.title}</h3>
                  <p className="mt-1.5 text-[15px] text-muted">{it.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        {c.results.note && <p className="mt-10 border-t border-mist-2 pt-4 text-[13.5px] text-muted">{c.results.note}</p>}
      </div>
    </section>
  )
}

function Studies({ n, content: c }: { n: string; content: ProductContent }) {
  const s = c.studies!
  return (
    <section id="studii" className="sec bg-mist" aria-labelledby="studies-title">
      <div className="wrap">
        <SectionHead n={n} label="Cercetare" title={s.heading} id="studies-title" />
        <p className="sub rev mt-5 max-w-[46em]">{s.intro}</p>
        <ul className="rev mt-10 rounded-[16px] bg-paper px-6 max-sm:-mx-2 max-sm:px-4">
          {s.items.map((it) => (
            <li key={it.title} className="grid gap-x-6 gap-y-2 border-b border-mist-2 py-6 last:border-0 md:grid-cols-12">
              <div className="md:col-span-3">
                <p className="font-mono text-[12px] tracking-[0.06em] text-cyan-700">{it.period}</p>
                <p className="mono mt-1 !text-[11px]">{it.topic}</p>
              </div>
              <div className="md:col-span-5">
                <h3 className="h3">{it.title}</h3>
                <p className="mt-1.5 text-[15px] text-muted">{it.text}</p>
              </div>
              <ul className="space-y-1.5 md:col-span-4">
                {it.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="group inline-flex gap-2 py-1.5 text-[14.5px] leading-snug text-ink hover:text-cyan-700">
                      <External className="mt-0.5 h-4 w-4 flex-none text-faint group-hover:text-cyan-700" />
                      <span className="underline decoration-line underline-offset-4 group-hover:decoration-cyan">{l.label}</span>
                      <span className="sr-only"> (se deschide într-o filă nouă)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function ProductFaq({ n, product, content: c }: { n: string } & Props) {
  // After the (mist) studies section, stay on white so the two don't merge into one block.
  return (
    <section className={`sec ${c.studies ? '' : 'bg-mist'}`} aria-labelledby="pfaq-title">
      <div className="wrap grid gap-y-10 md:grid-cols-12 md:gap-x-6">
        <div className="md:col-span-4">
          <Idx n={n}>Întrebări</Idx>
          <h2 id="pfaq-title" className="h2 rev">
            Întrebări despre {product.name}
          </h2>
          <Link href="/contact-us" className="tlink rev mt-3">
            Altă întrebare? Scrie-ne <Arrow />
          </Link>
        </div>
        <div className="rev md:col-span-8">
          <Faq items={c.faqs} />
        </div>
      </div>
    </section>
  )
}

function Related({ current }: { current: Product }) {
  const others = products.filter((p) => p.id !== current.id)
  return (
    <section className="sec" aria-labelledby="related-title">
      <div className="wrap">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="related-title" className="text-[26px] tracking-[-0.03em] max-sm:text-[22px]">
            Celelalte produse
          </h2>
          <Link href="/products" className="tlink">
            Compară toate <Arrow />
          </Link>
        </div>
        <ul className="mt-8 grid gap-3 md:grid-cols-2">
          {others.map((p) => (
            <li key={p.id}>
              <Link href={productHref(p)} className="group grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-5 rounded-[16px] bg-mist p-2 pr-6 transition-colors hover:bg-mist-2 max-sm:pr-4">
                <span className="block aspect-[4/3] overflow-hidden rounded-[12px]">
                  <ProductShot image={p.cutout} sizes="(min-width: 768px) 220px, 40vw" inset="md" className="!bg-paper" />
                </span>
                <span className="block">
                  <span className="mono block !text-[11px] !text-cyan-700">{p.category}</span>
                  <span className="mt-1 block text-[19px] font-medium tracking-[-0.02em] text-ink">{p.name}</span>
                  <span className="mt-1 block text-[14.5px] leading-snug text-muted max-sm:hidden">{p.summary}</span>
                  <span className="mt-2 flex items-center justify-between text-[15px] font-medium text-ink">
                    {formatMoney(p.price)}
                    <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
