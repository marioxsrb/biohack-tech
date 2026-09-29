import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Fragment, type ReactNode } from 'react'
import { legalPages, getLegalPage, type LegalBlock } from '@/content/legal'
import { pageMetadata } from '@/lib/seo'

export function generateStaticParams() {
  return legalPages.map((p) => ({ legal: p.slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: PageProps<'/[legal]'>): Promise<Metadata> {
  const page = getLegalPage((await params).legal)
  if (!page) return {}
  return pageMetadata({ title: page.title, description: page.description, path: `/${page.slug}` })
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g
const linkClass = 'font-medium text-ink underline underline-offset-4'

/** Paragraph text with [label](href) links: internal ones stay in the app, external ones open in a new tab. */
function rich(text: string): ReactNode {
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
          <span className="sr-only"> (se deschide într-o filă nouă)</span>
        </a>
      ),
    )
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return out
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') return <p className="mt-3 max-w-[40em]">{rich(block)}</p>
  if ('list' in block)
    return (
      <ul className="mt-3 max-w-[40em] list-disc space-y-1.5 pl-5 marker:text-faint">
        {block.list.map((item) => (
          <li key={item}>{rich(item)}</li>
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

export default async function LegalPage({ params }: PageProps<'/[legal]'>) {
  const page = getLegalPage((await params).legal)
  if (!page) notFound()

  return (
    <article className="pt-[calc(var(--nav-h)+var(--sec))] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+32px)]">
      <div className="wrap grid gap-y-8 md:grid-cols-12 md:gap-x-6">
        <header className="md:col-span-4">
          <h1 className="text-[36px] leading-[1.06] tracking-[-0.035em] max-sm:text-[30px]">{page.title}</h1>
          <p className="mt-3 text-[14.5px] text-muted">Actualizat la {page.updated}</p>
          <nav aria-label="Alte pagini legale" className="mt-8 max-md:hidden">
            <ul className="space-y-1 text-[15px]">
              {legalPages.map((p) => (
                <li key={p.slug}>
                  <Link href={`/${p.slug}`} aria-current={p.slug === page.slug ? 'page' : undefined} className={`flex min-h-9 items-center hover:text-ink ${p.slug === page.slug ? 'font-medium text-ink' : 'text-muted'}`}>
                    {p.shortTitle}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <div className="min-w-0 md:col-span-7 md:col-start-6">
          <div className="space-y-10">
            {page.sections.map((s) => (
              <section key={s.heading} id={s.id} className="scroll-mt-[calc(var(--nav-h)+24px)]">
                <h2 className="text-[20px] tracking-[-0.02em]">{s.heading}</h2>
                {s.body.map((b, i) => (
                  <Fragment key={i}>
                    <Block block={b} />
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
