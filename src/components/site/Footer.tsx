import Link from 'next/link'
import { site } from '@/config/site'
import { legalPages } from '@/content/legal'
import { Wordmark } from './Wordmark'

/** Fine print. The product shelf above it closes each page. */
export function Footer() {
  return (
    <footer className="bg-dark text-dark-muted">
      <div className="wrap flex flex-col gap-8 pt-14 pb-10 text-[14.5px] md:flex-row md:items-end md:justify-between">
        <div>
          <Wordmark />
          <p className="mt-4">
            <a href={`mailto:${site.email}`} className="hover:text-white">
              {site.email}
            </a>
            <span className="mx-2">·</span>
            <a href={site.phoneHref} className="hover:text-white">
              {site.phone}
            </a>
          </p>
        </div>
        <nav aria-label="Informații" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/about-us" className="hover:text-white">Despre noi</Link>
          <Link href="/contact-us" className="hover:text-white">Contact</Link>
          {legalPages.map((p) => (
            <Link key={p.slug} href={`/${p.slug}`} className="hover:text-white">
              {p.shortTitle}
            </Link>
          ))}
          <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
            ANPC
          </a>
        </nav>
      </div>
      <div className="wrap border-t border-dark-line py-6 text-[13px]">© {new Date().getFullYear()} {site.name}</div>
    </footer>
  )
}
