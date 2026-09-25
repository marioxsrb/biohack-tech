import Link from 'next/link'
import { Arrow } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'

export default function NotFound() {
  return (
    <section className="pt-[calc(var(--nav-h)+80px)] pb-[var(--sec)]">
      <div className="wrap max-w-[760px]">
        <p className="mono !text-cyan-700">404</p>
        <h1 className="mt-3 text-[36px] leading-tight tracking-[-0.035em]">Pagina nu există.</h1>
        <p className="sub mt-3">Poate a fost mutată. Produsele sunt aici:</p>
        <ul className="mt-8 border-t border-mist-2">
          {products.map((p) => (
            <li key={p.id} className="border-b border-mist-2">
              <Link href={productHref(p)} className="group flex items-center justify-between py-4 text-[18px] text-ink">
                {p.name}
                <Arrow className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
