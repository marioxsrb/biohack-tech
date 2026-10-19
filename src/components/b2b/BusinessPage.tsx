import Image from 'next/image'
import { BulkConfigurator } from '@/components/b2b/BulkConfigurator'
import { ContactForm } from '@/components/contact/ContactForm'
import { Check } from '@/components/ui/icons'
import { BULK_OFFER } from '@/config/promotions'
import { site, terms } from '@/config/site'
import { getProduct } from '@/content/catalog'
import type { Locale } from '@/i18n/locales'

export const BUSINESS_COPY = {
  ro: {
    title: 'Pentru companii: 40% reducere de la 25 de bucăți',
    description: 'Comenzi pentru firme: 40% reducere la NEUROS Calm și NEUROS Focus de la 25 de bucăți, combinate cum vrei. Factură pe firmă, plată cu cardul, transfer bancar sau ramburs.',
    kicker: 'Pentru companii',
    heading: (pct: number, min: number) => `${pct}% reducere de la ${min} de bucăți.`,
    lead: (min: number) => `Pentru echipe, clinici, săli de sport și cadouri corporate: NEUROS Calm și NEUROS Focus la 40% mai puțin, de la ${min} de bucăți, combinate cum vrei. Comanzi online, în câteva minute, cu factură pe firmă.`,
    ctaPick: 'Configurează comanda',
    ctaTalk: 'Vorbește cu noi',
    badges: ['Factură pe firmă (CUI)', 'Card, transfer sau ramburs', 'Livrare gratuită', 'Garanție 2 ani'],
    howTitle: 'Cum funcționează',
    steps: [
      ['Alegi cantitățile', 'Combini NEUROS Calm și NEUROS Focus. De la 25 de bucăți în total, reducerea de 40% se aplică singură.'],
      ['Comanzi pe firmă', 'În checkout completezi datele firmei (CUI, Reg. Com.) și alegi plata: card, transfer bancar sau ramburs.'],
      ['Confirmăm și livrăm', 'La plata cu cardul pregătim imediat coletul. La transfer sau ramburs, un coleg te sună să confirmăm comanda și livrarea.'],
    ] as [string, string][],
    configTitle: 'Configurează comanda',
    configLead: 'Prețurile sunt cu TVA inclus. Reducerea se calculează din nou la comandă, pe server, exact ca aici.',
    rulesTitle: 'Condițiile ofertei',
    rules: (min: number, pct: number) => [
      `${pct}% reducere la toate bucățile NEUROS Calm și NEUROS Focus, de la ${min} de bucăți în total (de exemplu 25 Calm, 25 Focus sau 15 Calm + 10 Focus).`,
      'NEUROS Amber și cartea „Știu. Vreau. DE CE NU POT?” nu intră în calculul celor 25 de bucăți și rămân la prețul lor obișnuit (Amber păstrează oferta 2+1).',
      'Reducerea pentru companii nu se cumulează cu codurile de reducere sau cu reducerile de cantitate (10% la 2, 20% la 3). Se aplică automat oferta cea mai avantajoasă.',
      'Plata cu cardul: comanda se confirmă la plată. Transfer bancar sau ramburs: un coleg Biohack Tech te contactează pentru confirmarea comenzii și a detaliilor de livrare, înainte de pregătire.',
      `Livrare gratuită în România. Retur în ${terms.returnDays} zile și garanție ${terms.warrantyYears} ani, ca la orice comandă.`,
    ],
    faqTitle: 'Întrebări frecvente',
    faq: [
      ['Pot combina NEUROS Calm și NEUROS Focus?', 'Da. Contează totalul: orice combinație de cel puțin 25 de bucăți primește 40% la toate bucățile Calm și Focus.'],
      ['Primesc factură pe firmă?', 'Da. În checkout alegi „Persoană juridică” și completezi denumirea, CUI și Reg. Com. Factura se emite automat pe firmă.'],
      ['Pot folosi și un cod de reducere?', 'Nu se cumulează. Se aplică reducerea cea mai mare, iar la 25+ bucăți aceea este reducerea de 40%.'],
      ['Cât durează livrarea?', `Pregătim comenzile în ${terms.processingDays}; la transfer sau ramburs, după confirmarea telefonică. Pentru termene precise la volume mari, scrie-ne.`],
      ['Vreau mai mult de 100 de bucăți dintr-un produs.', 'Scrie-ne sau sună-ne: pregătim oferta și livrarea împreună cu tine.'],
    ] as [string, string][],
    contactTitle: 'Vorbește cu un om',
    contactLead: `Pentru volume mari, livrări în mai multe locații sau întrebări despre factură, îți răspundem ${terms.responseTime}.`,
    phone: 'Telefon',
  },
  en: {
    title: 'For business: 40% off from 25 units',
    description: 'Business orders: 40% off NEUROS Calm and NEUROS Focus from 25 units, mixed as you like. Company invoice, card payment.',
    kicker: 'For business',
    heading: (pct: number, min: number) => `${pct}% off from ${min} units.`,
    lead: (min: number) => `For teams, clinics, gyms and corporate gifts: NEUROS Calm and NEUROS Focus at 40% less, from ${min} units, mixed as you like. Order online in a few minutes, with a company invoice.`,
    ctaPick: 'Build your order',
    ctaTalk: 'Talk to us',
    badges: ['Company invoice', 'Secure payment', 'Free delivery', '2-year warranty'],
    howTitle: 'How it works',
    steps: [
      ['Choose the quantities', 'Mix NEUROS Calm and NEUROS Focus. From 25 units in total, the 40% discount applies automatically.'],
      ['Order as a company', 'At checkout you enter your company details and choose how to pay.'],
      ['We confirm and ship', 'Card orders are packed right away. For bank transfer or cash on delivery, a colleague calls you to confirm the order and the delivery.'],
    ] as [string, string][],
    configTitle: 'Build your order',
    configLead: 'Prices include VAT. The discount is calculated again at checkout, on our server, exactly as here.',
    rulesTitle: 'Offer conditions',
    rules: (min: number, pct: number) => [
      `${pct}% off every NEUROS Calm and NEUROS Focus unit, from ${min} units in total (for example 25 Calm, 25 Focus or 15 Calm + 10 Focus).`,
      'NEUROS Amber and the book do not count towards the 25 units and keep their usual price (Amber keeps its 3-for-2 offer).',
      'The business discount does not combine with discount codes or the quantity discounts. The best offer applies automatically.',
      'Card payment: the order is confirmed on payment. Bank transfer or cash on delivery: a Biohack Tech colleague contacts you to confirm the order and the delivery details before packing.',
      `14-day returns and a ${terms.warrantyYears}-year warranty, as for every order.`,
    ],
    faqTitle: 'Questions',
    faq: [
      ['Can I mix NEUROS Calm and NEUROS Focus?', 'Yes. The total counts: any mix of at least 25 units gets 40% off every Calm and Focus unit.'],
      ['Do I get a company invoice?', 'Yes. At checkout choose “Company” and enter its details. The invoice is issued to the company automatically.'],
      ['Can I also use a discount code?', 'They do not combine. The largest discount applies, and from 25 units that is the 40% discount.'],
      ['I need more than 100 units of one product.', 'Write to us or call us: we prepare the offer and the delivery with you.'],
    ] as [string, string][],
    contactTitle: 'Talk to a person',
    contactLead: 'For large volumes, deliveries to several locations or invoice questions, we reply within 24 hours.',
    phone: 'Phone',
  },
}

/** /pentru-companii (and /for-business): the business offer, the order builder and a person to talk to. */
export function BusinessPage({ locale }: { locale: Locale }) {
  const t = BUSINESS_COPY[locale]
  const calm = getProduct('balance-wave', locale)
  const focus = getProduct('brainlink-pro', locale)
  return (
    <>
      <section className="pt-[calc(var(--nav-h)+48px)] max-sm:pt-[calc(var(--nav-h)+24px)]">
        <div className="wrap">
          <div className="grid overflow-hidden rounded-[32px] bg-ink text-white lg:grid-cols-12">
            <div className="p-[clamp(28px,5vw,72px)] lg:col-span-7">
              <p className="text-[14px] font-semibold tracking-[0.14em] text-cyan-300 uppercase">{t.kicker}</p>
              <h1 className="mt-4 max-w-[12em] text-[clamp(40px,5.6vw,80px)] leading-[0.98] tracking-[-0.045em] text-white">{t.heading(BULK_OFFER.percent, BULK_OFFER.minUnits)}</h1>
              <p className="mt-6 max-w-[34em] text-[18px] leading-relaxed text-white/80">{t.lead(BULK_OFFER.minUnits)}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#configurator" className="cta">
                  {t.ctaPick}
                </a>
                <a href="#contact" className="inline-flex min-h-[52px] items-center rounded-full px-6 text-[16px] font-medium text-white shadow-[inset_0_0_0_1.5px_rgba(255,255,255,.35)] hover:shadow-[inset_0_0_0_1.5px_#fff]">
                  {t.ctaTalk}
                </a>
              </div>
              <ul className="mt-9 grid gap-2.5 text-[15px] text-white/85 sm:grid-cols-2">
                {t.badges.map((b) => (
                  <li key={b} className="flex items-center gap-2.5">
                    <Check className="h-[18px] w-[18px] flex-none text-cyan-300" aria-hidden /> {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative grid min-h-[300px] grid-cols-2 items-end gap-2 bg-[radial-gradient(ellipse_at_70%_30%,rgba(34,211,238,.22),transparent_60%)] p-6 lg:col-span-5">
              <div aria-hidden className="absolute top-6 right-6 rounded-full bg-cyan-300 px-5 py-3 text-center text-ink shadow-xl">
                <span className="block text-[34px] leading-none font-semibold tracking-[-0.04em]">−{BULK_OFFER.percent}%</span>
                <span className="block text-[12.5px] font-semibold">{locale === 'en' ? `from ${BULK_OFFER.minUnits} units` : `de la ${BULK_OFFER.minUnits} buc.`}</span>
              </div>
              {[calm, focus].map((p) =>
                p ? (
                  <div key={p.id} className="relative aspect-square">
                    <Image src={p.cutout.src} alt={p.cutout.alt} fill priority sizes="(min-width: 1024px) 240px, 45vw" className={`object-contain p-[8%] drop-shadow-2xl ${p.cutout.bleed === 'bottom' ? 'object-bottom pb-0' : ''}`} />
                  </div>
                ) : null,
              )}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="how" className="pt-[var(--sec)]">
        <div className="wrap">
          <h2 id="how" className="text-[clamp(28px,3.2vw,44px)] tracking-[-0.035em]">{t.howTitle}</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {t.steps.map(([title, text], i) => (
              <li key={title} className="rounded-[22px] bg-paper p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white">{i + 1}</span>
                <p className="mt-4 text-[19px] font-semibold tracking-[-0.01em] text-ink">{title}</p>
                <p className="mt-2 text-[15.5px] leading-relaxed text-text">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="configurator" aria-labelledby="config" className="scroll-mt-[calc(var(--nav-h)+16px)] pt-[var(--sec)]">
        <div className="wrap">
          <h2 id="config" className="text-[clamp(28px,3.2vw,44px)] tracking-[-0.035em]">{t.configTitle}</h2>
          <p className="mt-2 max-w-[40em] text-[16px] text-muted">{t.configLead}</p>
          <div className="mt-8">
            <BulkConfigurator />
          </div>
        </div>
      </section>

      <section aria-labelledby="rules" className="pt-[var(--sec)]">
        <div className="wrap grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 id="rules" className="text-[clamp(26px,2.8vw,38px)] tracking-[-0.03em]">{t.rulesTitle}</h2>
            <ul className="mt-6 space-y-4">
              {t.rules(BULK_OFFER.minUnits, BULK_OFFER.percent).map((r) => (
                <li key={r} className="flex gap-3 text-[15.5px] leading-relaxed text-text">
                  <Check className="mt-1 h-[18px] w-[18px] flex-none text-cyan-700" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-6">
            <h2 className="text-[clamp(26px,2.8vw,38px)] tracking-[-0.03em]">{t.faqTitle}</h2>
            <div className="mt-6 divide-y divide-mist-2 border-y border-mist-2">
              {t.faq.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16.5px] font-medium text-ink">
                    {q}
                    <span aria-hidden className="text-[20px] text-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-text">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contact" aria-labelledby="contact-title" className="scroll-mt-[calc(var(--nav-h)+16px)] py-[var(--sec)]">
        <div className="wrap">
          <div className="grid overflow-hidden rounded-[28px] bg-paper lg:grid-cols-12">
            <div className="p-[clamp(24px,4vw,48px)] lg:col-span-5">
              <h2 id="contact-title" className="text-[clamp(26px,2.8vw,38px)] tracking-[-0.03em]">{t.contactTitle}</h2>
              <p className="mt-3 text-[16px] leading-relaxed text-text">{t.contactLead}</p>
              <ul className="mt-6 space-y-3 text-[17px]">
                <li>
                  <span className="block text-[14px] text-muted">Email</span>
                  <a href={`mailto:${site.email}?subject=${encodeURIComponent(locale === 'en' ? 'Business order' : 'Comandă pentru companie')}`} className="font-medium text-ink underline-offset-4 hover:underline">
                    {site.email}
                  </a>
                </li>
                <li>
                  <span className="block text-[14px] text-muted">{t.phone}</span>
                  <a href={site.phoneHref} className="font-medium text-ink tabular-nums underline-offset-4 hover:underline">
                    {site.phone}
                  </a>
                </li>
              </ul>
            </div>
            <div className="bg-white p-[clamp(24px,4vw,48px)] lg:col-span-7">
              <ContactForm compact />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
