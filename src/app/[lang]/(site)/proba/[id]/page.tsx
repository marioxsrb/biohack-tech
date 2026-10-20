import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import Link from '@/components/ui/Link'
import { absolute, pageMetadata } from '@/lib/seo'
import { readPhoto } from '@/server/try-on-photos'

/**
 * A NEUROS Amber try-on photo someone shared as a link: the photo, one line about the glasses, and the way to try
 * them yourself. Never indexed; the link preview (WhatsApp, Facebook) shows the photo.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const meta = pageMetadata({
    title: 'Cum îmi stau ochelarii NEUROS Amber?',
    description: 'Am probat NEUROS Amber pe cameră: lentile galbene pentru seri mai liniștite. Probează-i și tu.',
    path: `/proba/${id}`,
    translated: false,
    image: { url: absolute(`/api/proba/${id}`), width: 960, height: 720, alt: 'Probă NEUROS Amber pe cameră' },
  })
  return { ...meta, robots: { index: false, follow: false } }
}

export default async function SharedTryOn({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const photo = await readPhoto(id).catch(() => null)
  if (!photo) notFound()
  return (
    <section className="wrap pt-[calc(var(--nav-h)+40px)] pb-[var(--sec)]">
      <div className="mx-auto max-w-[720px]">
        <p className="text-[16px] font-medium text-cyan-700">Probă pe cameră</p>
        <h1 className="mt-1 text-[clamp(32px,4vw,52px)] leading-[1.02] tracking-[-0.045em]">Cum îmi stau ochelarii NEUROS Amber?</h1>
        {/* eslint-disable-next-line @next/next/no-img-element -- a stored photo served by the API, not a build asset */}
        <img src={`/api/proba/${id}`} alt="Probă NEUROS Amber pe cameră" width={960} height={720} className="mt-6 h-auto w-full rounded-[24px] bg-mist" />
        <p className="mt-6 text-[17px] leading-relaxed text-text">Lentile galbene pentru seară, cinci rame din care alegi. Le poți proba și tu, live, pe camera telefonului.</p>
        <Link href="/products/amber" className="cta mt-6 max-sm:!w-full">
          Probează-i și tu
        </Link>
      </div>
    </section>
  )
}
