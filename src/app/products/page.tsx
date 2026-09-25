import type { Metadata } from 'next'
import { ProductShowcase } from '@/components/home/ProductShowcase'
import { Assurance } from '@/components/site/Assurance'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Produse',
  description:
    'Balance Wave pentru relaxare, BrainLink Pro pentru focus și Ochelari Biohack pentru ecrane. Livrare gratuită în România, retur în 14 zile.',
  path: '/products',
})

export default function ProductsPage() {
  return (
    <div className="pt-[calc(var(--nav-h)-var(--sec)*0.3)]">
      <ProductShowcase title="Produse" headingLevel={1} />
      <Assurance />
    </div>
  )
}
