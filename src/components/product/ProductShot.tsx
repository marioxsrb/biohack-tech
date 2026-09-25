import Image from 'next/image'
import type { ProductImage } from '@/content/catalog'

type Props = {
  image: ProductImage
  sizes: string
  priority?: boolean
  /** Padding around cutouts, as a fraction of the frame. */
  inset?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
}

const insets = { none: 'p-0', sm: 'p-[6%]', md: 'p-[10%]', lg: 'p-[14%]' }

/**
 * Renders a product image inside a frame the parent sizes.
 * Cutouts and studio shots are shown whole (never cropped); photos fill the frame.
 */
export function ProductShot({ image, sizes, priority, inset = 'md', className = '' }: Props) {
  const isPhoto = image.kind === 'photo'
  return (
    <div className={`stage relative h-full w-full overflow-hidden ${className}`}>
      <div className={`absolute inset-0 ${isPhoto ? '' : insets[inset]}`}>
        <div className="relative h-full w-full">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes={sizes}
            priority={priority}
            data-kind={image.kind}
            placeholder={isPhoto ? 'blur' : 'empty'}
            className={isPhoto ? 'object-cover' : 'object-contain'}
          />
        </div>
      </div>
    </div>
  )
}
