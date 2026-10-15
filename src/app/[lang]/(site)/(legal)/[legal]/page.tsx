import type { Metadata } from 'next'
import Link from '@/components/ui/Link'
import { notFound } from 'next/navigation'
import { Fragment, type ReactNode } from 'react'
import { legalPages, getLegalPage, type LegalBlock } from '@/content/legal'
import { legalPagesEn } from '@/content/legal-en'
import { getLocale } from '@/i18n/server'
import { pageMetadata } from '@/lib/seo'

/** The legal texts in Romanian (binding) and their English translation on /en, which says the Romanian prevails. */
const COPY = {
  ro: { updated: 'Actualizat la', otherPages: 'Alte pagini legale', newTab: ' (se deschide într-o filă nouă)', note: null },
  en: { updated: 'Updated on', otherPages: 'Other legal pages', newTab: ' (opens in a new tab)', note: 'This is an English translation for convenience. If it differs from the Romanian version, the Romanian version prevails.' },
}

export function generateStaticParams() {
  return legalPages.map((p) => ({ legal: p.slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: PageProps<'/[lang]/[legal]'>): Promise<Metadata> {
  const locale = await getLocale()
  const page = getLegalPage((await params).legal, locale)
  if (!page) return {}
  return pageMetadata({ title: page.title, description: page.description, path: `/${page.slug}`, locale, translated: true })
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g
const linkClass = 'font-medium text-ink underline underline-offset-4'

/** Paragraph text with [label](href) links: internal ones stay in the app, external ones open in a new tab. */
function rich(text: string, newTab: string): ReactNode {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LINK)) {
    out.push(text.slice(last, m.index))
    const [, label, href] = m
    out.push(
      href.startsWith('/') ? (
        <Link key={m.index} href={href} className={linkClass}>
          {label}
        </Link>
      ) : (
        <a key={m.index} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {label}
          <span className="sr-only">{newTab}</span>
        </a>
      ),
    )
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return out
}

function Block({ block, newTab }: { block: LegalBlock; newTab: string }) {
  if (typeof block === 'string') return <p className="mt-3 max-w-[40em]">{rich(block, newTab)}</p>
  if ('list' in block)
    return (
      <ul className="mt-3 max-w-[40em] list-disc space-y-1.5 pl-5 marker:text-faint">
        {block.list.map((item) => (
          <li key={item}>{rich(item, newTab)}</li>
        ))}
      </ul>
    )
  return (
    <div className="mt-4 overflow-x-auto rounded-[14px] bg-paper shadow-[inset_0_0_0_1px_var(--color-mist-2)]">
      <table className="w-full min-w-[520px] border-collapse text-left text-[14.5px] leading-snug">
        <thead>
          <tr>
            {block.table.head.map((h) => (
              <th key={h} scope="col" className="border-b border-mist-2 px-4 py-3 font-semibold text-ink">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((r) => (
            <tr key={r.join('|')} className="border-b border-mist-2 last:border-0">
              {r.map((c, i) => (
                <td key={i} className={`px-4 py-3 align-top ${i === 0 ? 'font-medium text-ink' : 'text-text'}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function LegalPage({ params }: PageProps<'/[lang]/[legal]'>) {
  const locale = await getLocale()
  const page = getLegalPage((await params).legal, locale)
  if (!page) notFound()
  const t = COPY[locale]
  const lang = locale === 'en' ? 'en' : 'ro'
  // "14 octombrie 2026" → "14 October 2026" on the English page.
  const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']
  const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const updated = lang === 'en' ? page.updated.replace(/[a-zăîâșț]+/i, (m) => EN_MONTHS[MONTHS.indexOf(m.toLowerCase())] ?? m) : page.updated

  return (
    <article className="pt-[calc(var(--nav-h)+var(--sec))] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+32px)]">
      <div className="wrap grid gap-y-8 md:grid-cols-12 md:gap-x-6">
        <header className="md:col-span-4">
          {t.note && <p className="mb-5 rounded-[12px] bg-paper px-4 py-3 text-[14.5px] leading-snug text-text">{t.note}</p>}
          <h1 lang={lang} className="text-[36px] leading-[1.06] tracking-[-0.035em] max-sm:text-[30px]">{page.title}</h1>
          <p className="mt-3 text-[14.5px] text-muted">
            {t.updated} <span lang={lang}>{updated}</span>
          </p>
          <nav aria-label={t.otherPages} className="mt-8 max-md:hidden">
            <ul className="space-y-1 text-[15px]">
              {(lang === 'en' ? legalPagesEn : legalPages).map((p) => (
                <li key={p.slug}>
                  <Link href={`/${p.slug}`} lang={lang} aria-current={p.slug === page.slug ? 'page' : undefined} className={`flex min-h-9 items-center hover:text-ink ${p.slug === page.slug ? 'font-medium text-ink' : 'text-muted'}`}>
                    {p.shortTitle}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <div lang={lang} className="min-w-0 md:col-span-7 md:col-start-6">
          <div className="space-y-10">
            {page.sections.map((s) => (
              <section key={s.heading} id={s.id} className="scroll-mt-[calc(var(--nav-h)+24px)]">
                <h2 className="text-[20px] tracking-[-0.02em]">{s.heading}</h2>
                {s.body.map((b, i) => (
                  <Fragment key={i}>
                    <Block block={b} newTab={t.newTab} />
                  </Fragment>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}
