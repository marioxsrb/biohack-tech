import Image from 'next/image'
import cover from '@/assets/img/carte/coperta.png'

/**
 * The book's cover as an object: the original artwork (NEUROS, 425 × 651 px, lossless PNG, the largest that exists,
 * also inside the PDF), a spine shade, the page edges and a soft shadow, lifting slightly on hover.
 *
 * Shown no wider than ~260 CSS px, so even a retina screen gets close to one source pixel per device pixel; it is
 * never stretched beyond what the file holds. next/image serves AVIF/WebP from the PNG at quality 85.
 */
export function BookCover({ width, sizes, alt, priority = false, className = '', lift = true }: { width: string; sizes: string; alt: string; priority?: boolean; className?: string; lift?: boolean }) {
  return (
    <div className={`group/book relative [perspective:1400px] ${className}`} style={{ width }}>
      <div
        className={`relative transition-transform duration-700 ease-[var(--ease-brand)] [transform-style:preserve-3d] ${lift ? 'motion-safe:group-hover/book:[transform:rotateY(-9deg)_translateY(-6px)]' : ''}`}
      >
        {/* Pages: two thin layers behind the right edge. */}
        <span aria-hidden className="absolute top-[1.2%] right-[-2.4%] bottom-[1.2%] w-[4%] rounded-r-[3px] bg-[repeating-linear-gradient(90deg,#f4efe6_0_1px,#e3dccf_1px_2px)] shadow-[inset_-1px_0_0_rgba(0,0,0,.08)]" />
        <span aria-hidden className="absolute top-[0.6%] right-[-1.2%] bottom-[0.6%] w-[3%] rounded-r-[3px] bg-[#f7f3ec]" />
        <Image
          src={cover}
          alt={alt}
          priority={priority}
          quality={85}
          sizes={sizes}
          className="relative block h-auto w-full rounded-[3px_4px_4px_3px] shadow-[0_1px_1px_rgba(0,0,0,.08),0_18px_28px_-14px_rgba(11,19,22,.35),0_42px_70px_-30px_rgba(11,19,22,.45)]"
        />
        {/* The spine's crease and a faint gloss: the cover reads as card, not as a flat picture. */}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[7%] rounded-l-[3px] bg-[linear-gradient(90deg,rgba(0,0,0,.16),rgba(0,0,0,.04)_45%,rgba(255,255,255,.18)_70%,rgba(255,255,255,0))]" />
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[3px_4px_4px_3px] bg-[linear-gradient(115deg,rgba(255,255,255,.22),rgba(255,255,255,0)_38%)]" />
      </div>
    </div>
  )
}
