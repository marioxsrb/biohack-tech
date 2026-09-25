import Link from 'next/link'
import { legalPages } from '@/content/legal'
import { site } from '@/config/site'

/**
 * The ending, on the same surface as the page above it: the opening line returns,
 * then the practical things. No dark box.
 */
export function Footer() {
  return (
    <footer className="text-muted">
      <div className="wrap border-t border-line pt-[calc(var(--sec)*0.8)] pb-12">
        <p className="text-[clamp(40px,5.6vw,84px)] leading-[0.96] font-medium tracking-[-0.045em] text-ink">
          Minte limpede.
          <br />
          Corp relaxat.
        </p>
        <div className="mt-14 flex flex-col gap-8 text-[15px] md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="font-semibold tracking-[0.04em] text-ink">
              BIOHACK <span className="text-cyan-700">TECH</span>
            </p>
            <p>
              <a href={`mailto:${site.email}`} className="hover:text-ink">
                {site.email}
              </a>
              <span className="mx-2" aria-hidden>
                ·
              </span>
              <a href={site.phoneHref} className="hover:text-ink">
                {site.phone}
              </a>
            </p>
          </div>
          <nav aria-label="Informații" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/about-us" className="hover:text-ink">
              Despre noi
            </Link>
            <Link href="/contact-us" className="hover:text-ink">
              Contact
            </Link>
            {legalPages.map((p) => (
              <Link key={p.slug} href={`/${p.slug}`} className="hover:text-ink">
                {p.shortTitle}
              </Link>
            ))}
            <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener noreferrer" className="hover:text-ink">
              ANPC
            </a>
          </nav>
        </div>
        <p className="mt-10 text-[13.5px]">© {new Date().getFullYear()} {site.name}</p>
      </div>
    </footer>
  )
}
