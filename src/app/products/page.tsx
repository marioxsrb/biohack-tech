import type { Metadata } from 'next'
import { Lineup } from '@/components/site/Lineup'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Produse',
  description:
    'Balance Wave pentru relaxare, BrainLink Pro pentru focus și Ochelari Biohack pentru ecrane. Livrare gratuită în România, retur în 14 zile.',
  path: '/products',
})

export default function ProductsPage() {
  return (
    <div className="bg-mist pt-[var(--nav-h)]">
      <Lineup title="Produse" headingLevel={1} />
    </div>
  )
}
