import Image from 'next/image'
import type { ProductImage } from '@/content/catalog'

/** Small product image on a tile: cutouts whole, photos cropped. The parent sets size and background. */
export function Thumb({ image, sizes = '96px', className = '' }: { image: ProductImage; sizes?: string; className?: string }) {
  return (
    <span className={`relative block flex-none overflow-hidden rounded-[12px] ${className}`}>
      <Image
        src={image.src}
        alt=""
        fill
        sizes={sizes}
        className={image.kind === 'photo' ? 'object-cover' : `object-contain p-[10%] ${image.bleed === 'bottom' ? 'object-bottom pb-0' : ''}`}
      />
    </span>
  )
}
