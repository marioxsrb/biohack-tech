import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { legalPages, getLegalPage } from '@/content/legal'
import { site } from '@/config/site'
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

export default async function LegalPage({ params }: PageProps<'/[legal]'>) {
  const page = getLegalPage((await params).legal)
  if (!page) notFound()

  return (
    <article className="pt-[calc(var(--nav-h)+64px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+32px)]">
      <div className="wrap grid gap-y-8 md:grid-cols-12 md:gap-x-6">
        <header className="md:col-span-4">
          <p className="idx" data-n="Informații">
            <i aria-hidden />
            {site.name}
          </p>
          <h1 className="text-[36px] leading-[1.06] tracking-[-0.035em] max-sm:text-[30px]">{page.title}</h1>
        </header>
        <div className="md:col-span-7 md:col-start-6">
          <p className="rounded-[12px] bg-mist px-5 py-4 text-[15px] text-text">
            Aceasta este versiunea pe scurt. Textul complet va fi publicat în curând. Pentru orice întrebare, scrie-ne la{' '}
            <a href={`mailto:${site.email}`} className="font-medium text-ink underline underline-offset-4">
              {site.email}
            </a>
            .
          </p>
          <div className="mt-10 space-y-9">
            {page.sections.map((s, i) => (
              <section key={s.heading}>
                <h2 className="text-[20px] tracking-[-0.02em]">
                  <span className="mr-3 font-mono text-[13px] text-cyan-700">{String(i + 1).padStart(2, '0')}</span>
                  {s.heading}
                </h2>
                {s.body.map((b) => (
                  <p key={b} className="mt-3 max-w-[40em]">
                    {b}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}
