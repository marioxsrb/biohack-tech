import Image from 'next/image'
import { getProduct } from '@/content/catalog'

/**
 * The Balance Wave device on a dark stage: a red bloom, a grey (off) layer and the lit
 * photo over it. The parent drives it with --rise (0 → 1, rising from the lower edge),
 * --on (0 → 1, switching on) and --gone (0 → 1, leaving upwards). --bwx sets where it
 * stands horizontally (right of centre on desktop, centred on phones).
 * The device sits on the lower edge because its cable is cropped in the source photo.
 */
export function BalanceWaveVisual() {
  const p = getProduct('balance-wave')!
  return (
    <>
      <div aria-hidden className="bwv-bloom pointer-events-none absolute inset-0" />
      <div className="bwv-device absolute bottom-0 w-[min(720px,56vw)] max-md:w-[88vw]">
        <div className="relative aspect-[631/478]">
          <Image src={p.cutout.src} alt="" aria-hidden fill sizes="(min-width: 768px) 720px, 88vw" className="object-contain object-bottom brightness-[.8] grayscale" />
          <Image src={p.cutout.src} alt={p.cutout.alt} fill sizes="(min-width: 768px) 720px, 88vw" className="bwv-lit object-contain object-bottom" />
        </div>
      </div>
    </>
  )
}
