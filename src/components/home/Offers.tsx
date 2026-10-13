import Image from 'next/image'
import Link from '@/components/ui/Link'
import { OfferTrigger } from '@/components/offers/OfferTrigger'
import { Arrow } from '@/components/ui/icons'
import { PROMOTIONS } from '@/config/promotions'
import { getProduct } from '@/content/catalog'
import { getLocale } from '@/i18n/server'

const COPY = {
  ro: {
    title: 'Oferte: până la 20% reducere',
    intro: 'Reducerile se aplică singure în coș. Le vezi pe fiecare în comandă și pe factură.',
    products: (n: number) => `${n} bucăți din același produs`,
    off: 'reducere',
    bundleText: 'Iei trei bucăți din același produs și primești 20% reducere la ele. Restul comenzii rămâne la prețul întreg.',
    firstTier: (n: number, pct: number) => `La ${n} bucăți primești ${pct}%.`,
    bundleLabel: 'Alege produsul pentru 20% reducere',
    bundleCta: 'Alege produsul',
    amberKicker: 'La 3 perechi',
    amberDeal: '2+1',
    free: 'gratis',
    amberText: 'Plătești două perechi. A treia este gratuită. Poți combina ramele.',
    amberLabel: 'Alege 3 perechi NEUROS Amber, plătești 2',
    amberCta: 'Alege 3 perechi',
    note: 'Ofertele se cumulează. Reducerea de 10% sau 20% se calculează separat pentru fiecare produs: NEUROS Calm sau Focus.',
    details: 'Detalii',
  },
  en: {
    title: 'Offers: up to 20% off',
    intro: 'The discounts apply automatically in the cart. You see each one in your order and on the invoice.',
    products: (n: number) => `${n} of the same product`,
    off: 'off',
    bundleText: 'Take three of the same product and get 20% off those three. The rest of the order stays at full price.',
    firstTier: (n: number, pct: number) => `With ${n} you get ${pct}% off.`,
    bundleLabel: 'Choose the product for 20% off',
    bundleCta: 'Choose the product',
    amberKicker: 'With 3 pairs',
    amberDeal: '3 for 2',
    free: 'one free',
    amberText: 'You pay for two pairs. The third one is free. You can mix the frames.',
    amberLabel: 'Choose 3 pairs of NEUROS Amber, pay for 2',
    amberCta: 'Choose 3 pairs',
    note: 'The offers add up. The 10% or 20% discount is counted separately for each product: NEUROS Calm or Focus.',
    details: 'Details',
  },
}

/**
 * The two standing offers. Readable in one line each ("3 bucăți, 20% reducere" / "2+1 gratis"), then one
 * sentence, then one action. Rules and names come from config/promotions.ts; the cart computes them.
 * No countdowns, no struck-through prices, no stickers.
 */
export async function Offers() {
  const locale = await getLocale()
  const t = COPY[locale]
  const bundle = PROMOTIONS.find((p) => p.kind === 'bundle_percent')!
  const amber = PROMOTIONS.find((p) => p.kind === 'buy_x_get_y')!
  const bundleProducts = bundle.products.map((id) => getProduct(id, locale)!)
  const amberProduct = getProduct(amber.products[0], locale)!
  const top = bundle.kind === 'bundle_percent' ? bundle.tiers[bundle.tiers.length - 1] : null
  const first = bundle.kind === 'bundle_percent' ? bundle.tiers[0] : null
  const percent = top?.percent ?? 0
  const minUnits = top?.minUnits ?? 0

  return (
    <section aria-labelledby="offers-title" className="wrap pt-[var(--sec)]">
      <h2 id="offers-title" className="text-[clamp(34px,4vw,54px)] leading-[1] tracking-[-0.045em]">
        {t.title}
      </h2>
      <p className="mt-4 max-w-[34em] text-[18px] leading-relaxed text-text">{t.intro}</p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <article aria-labelledby="offer-bundle" className="on-dark relative flex flex-col overflow-hidden rounded-[24px] bg-dark p-[clamp(24px,3.2vw,40px)] text-white">
          <p className="text-[13px] font-semibold tracking-[0.12em] text-cyan uppercase">NEUROS Calm · Focus</p>
          <h3 id="offer-bundle" className="mt-5 !text-white">
            <span className="block text-[22px] font-medium tracking-[-0.02em] text-white/80">{t.products(minUnits)}</span>
            <span className="mt-1 block text-[clamp(56px,6vw,80px)] leading-[0.95] font-medium tracking-[-0.05em]">
              {percent}% <span className="text-[0.45em] tracking-[-0.02em] text-cyan">{t.off}</span>
            </span>
          </h3>
          <p className="mt-4 max-w-[26em] text-[16px] leading-relaxed text-white/80">
            {t.bundleText}{first && first !== top && ` ${t.firstTier(first.minUnits, first.percent)}`}
          </p>
          {/* The products are the way in: the image opens the product picker, like the button. */}
          <OfferTrigger offer="bundle" placement="homepage" className="group mt-7 grid w-full cursor-pointer grid-cols-3 items-start gap-3 text-left">
            {bundleProducts.map((p) => (
              <span key={p.id} className="block">
                <span className="relative block aspect-square rounded-[16px] bg-mist transition-colors duration-200 group-hover:bg-paper">
                  <Image src={p.cutout.src} alt="" fill sizes="140px" className={`object-contain p-[14%] transition-transform duration-300 group-hover:scale-[1.03] ${p.cutout.bleed === 'bottom' ? 'object-bottom pb-0' : ''}`} />
                </span>
                <span className="mt-2 block text-center text-[14px] font-medium text-white/85 group-hover:text-white">{p.model}</span>
              </span>
            ))}
            {/* The visible names first, then what the button does: the accessible name matches what is on screen. */}
            <span className="sr-only">{t.bundleLabel}</span>
          </OfferTrigger>
          <OfferTrigger offer="bundle" placement="homepage" className="cta sm mt-7 self-start">
            {t.bundleCta} <Arrow />
          </OfferTrigger>
        </article>

        <article aria-labelledby="offer-amber" className="relative flex flex-col overflow-hidden rounded-[24px] bg-paper p-[clamp(24px,3.2vw,40px)]">
          <p className="text-[13px] font-semibold tracking-[0.12em] text-cyan-700 uppercase">NEUROS Amber</p>
          <h3 id="offer-amber" className="mt-5">
            <span className="block text-[22px] font-medium tracking-[-0.02em] text-muted">{t.amberKicker}</span>
            <span className="mt-1 block text-[clamp(56px,6vw,80px)] leading-[0.95] font-medium tracking-[-0.05em] text-ink">
              {t.amberDeal} <span className="ml-1 inline-flex rounded-full bg-[#f5b041] px-3 py-1 align-middle text-[0.3em] font-semibold tracking-normal text-ink">{t.free}</span>
            </span>
          </h3>
          <p className="mt-4 max-w-[24em] text-[16px] leading-relaxed text-text">{t.amberText}</p>
          <OfferTrigger offer="amber" placement="homepage" label={t.amberLabel} className="group relative mt-auto block aspect-[16/7] w-full cursor-pointer rounded-[16px] bg-mist transition-colors duration-200 hover:bg-mist-2">
            <Image src={amberProduct.cutout.src} alt="" fill sizes="(min-width: 768px) 480px, 90vw" className="object-contain p-[6%] transition-transform duration-300 group-hover:scale-[1.03]" />
          </OfferTrigger>
          <OfferTrigger offer="amber" placement="homepage" className="cta sm mt-5 self-start">
            {t.amberCta} <Arrow />
          </OfferTrigger>
        </article>
      </div>
      <p className="mt-4 text-[14px] text-muted">
        {t.note}{' '}
        <Link href="/plati" className="underline underline-offset-4 hover:text-ink">
          {t.details}
        </Link>
      </p>
    </section>
  )
}
