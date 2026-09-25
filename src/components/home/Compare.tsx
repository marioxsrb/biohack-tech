import Link from 'next/link'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { ProductShot } from '@/components/product/ProductShot'
import { Idx } from '@/components/ui/Idx'
import { Arrow } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { compareRows } from '@/content/home'
import { formatMoney } from '@/lib/money'

/**
 * Side-by-side comparison. Below 768px each row's label moves above its three values,
 * so all three products stay visible without horizontal scrolling. Explicit roles keep
 * the table semantics that some browsers drop when table display is changed.
 */
export function Compare({ index = '02', headingLevel = 2 }: { index?: string; headingLevel?: 2 | 1 }) {
  const H = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section className="sec bg-mist" aria-labelledby="compare-title">
      <div className="wrap">
        <header className="grid items-end gap-y-4 md:grid-cols-12 md:gap-x-6">
          <div className="md:col-span-7">
            <Idx n={index}>Compară</Idx>
            <H id="compare-title" className="h2 rev">
              Care ți se potrivește?
            </H>
          </div>
          <p className="sub rev md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-9">
            Pornește de la ce vrei să schimbi. Dacă ai nevoie de o recomandare, scrie-ne.
          </p>
        </header>

        <div className="rev mt-12 rounded-[16px] bg-paper p-2 max-md:mt-8 md:p-3">
          <table role="table" className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">Comparație între Balance Wave, BrainLink Pro și Ochelari Biohack</caption>
            <thead role="rowgroup">
              <tr role="row" className="max-md:grid max-md:grid-cols-3">
                <td role="presentation" className="w-[22%] max-md:hidden" />
                {products.map((p) => (
                  <th role="columnheader" key={p.id} scope="col" className="p-2 align-top font-normal md:p-3">
                    <Link href={productHref(p)} className="group block">
                      <span className="block aspect-[4/3] overflow-hidden rounded-[10px]">
                        <ProductShot image={p.cutout} sizes="(min-width: 768px) 260px, 30vw" inset="md" />
                      </span>
                      <span className="mt-3 block text-[15px] font-medium leading-tight text-ink group-hover:underline md:text-[18px] md:tracking-[-0.015em]">
                        {p.name}
                      </span>
                      <span className="mt-0.5 block text-[13.5px] tabular-nums text-muted md:text-[15px]">
                        {formatMoney(p.price)}
                      </span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {compareRows.map((row) => (
                <tr role="row" key={row.label} className="border-t border-mist-2 max-md:grid max-md:grid-cols-3">
                  <th
                    role="rowheader"
                    scope="row"
                    className="mono p-3 align-top !text-[11px] font-normal max-md:col-span-3 max-md:px-2 max-md:pt-3 max-md:pb-0 md:pt-4"
                  >
                    {row.label}
                  </th>
                  {products.map((p) => {
                    const v = row.values[p.id]
                    return (
                      <td
                        role="cell"
                        key={p.id}
                        className="p-3 align-top text-[14px] leading-snug text-ink hyphens-auto [overflow-wrap:anywhere] max-md:px-2 max-md:pt-1.5 md:text-[15.5px] md:hyphens-none"
                      >
                        {v ?? (
                          <span className="text-faint">
                            <span aria-hidden>·</span>
                            <span className="sr-only">Nu este cazul</span>
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr role="row" className="border-t border-mist-2 max-md:grid max-md:grid-cols-3">
                <td role="presentation" className="max-md:hidden" />
                {products.map((p) => (
                  <td role="cell" key={p.id} className="p-2 pt-4 align-top md:p-3 md:pt-5">
                    {p.variants ? (
                      <Link href={productHref(p)} className="btn2 sm w-full max-md:px-2 max-md:text-[13px]">
                        Alege modelul
                      </Link>
                    ) : (
                      <>
                        <AddToCartButton productId={p.id} size="sm" className="w-full max-md:hidden" />
                        <Link href={productHref(p)} className="btn2 sm w-full px-2 text-[13px] md:hidden">
                          Detalii <Arrow className="h-3.5 w-3.5" />
                        </Link>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
