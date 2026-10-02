import { ContactForm } from '@/components/contact/ContactForm'
import { Mail, Phone } from '@/components/ui/icons'
import { site, terms } from '@/config/site'
import { getLocale } from '@/i18n/server'

const COPY = {
  ro: {
    kicker: 'Suport Biohack Tech',
    title: 'Vrei ajutor să alegi?',
    text: `Spune-ne pentru ce îl vrei. Îți recomandăm dispozitivul potrivit. Îți răspundem ${terms.responseTime}.`,
    write: 'Scrie-ne',
    phone: 'Telefonul este opțional.',
  },
  en: {
    kicker: 'Biohack Tech support',
    title: 'Want help choosing?',
    text: 'Tell us what you need it for. We will recommend the right device. We reply within 24 hours.',
    write: 'Write to us',
    phone: 'Your phone number is optional.',
  },
}

/**
 * Support, not a form dump: a warm panel that says who answers and how fast, the direct lines, then a
 * quiet, well-set form on white. Compact on purpose.
 */
export async function ContactSection() {
  const t = COPY[await getLocale()]
  return (
    <section id="contact" aria-labelledby="contact-title" className="wrap scroll-mt-[calc(var(--nav-h)+16px)] py-[var(--sec)]">
      <div className="grid overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0f1c20,#081113_60%)] lg:grid-cols-12">
        <div className="on-dark relative flex flex-col p-[clamp(24px,3.6vw,48px)] text-white lg:col-span-5">
          <span aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(6_182_212/.22),transparent)]" />
          <p className="relative text-[13px] font-semibold tracking-[0.12em] text-cyan uppercase">{t.kicker}</p>
          <h2 id="contact-title" className="relative mt-3 max-w-[12em] text-[clamp(30px,3.2vw,44px)] leading-[1.02] tracking-[-0.04em] !text-white">
            {t.title}
          </h2>
          <p className="relative mt-4 max-w-[26em] text-[16.5px] leading-relaxed text-white/80">
            {t.text}
          </p>
          <ul className="relative mt-8 space-y-2">
            <li>
              <a href={`mailto:${site.email}`} className="flex min-h-12 items-center gap-3 rounded-[12px] bg-white/[0.06] px-4 text-[15.5px] text-white transition-colors hover:bg-white/[0.12]">
                <Mail className="h-[18px] w-[18px] text-cyan" /> {site.email}
              </a>
            </li>
            <li>
              <a href={site.phoneHref} className="flex min-h-12 items-center gap-3 rounded-[12px] bg-white/[0.06] px-4 text-[15.5px] text-white transition-colors hover:bg-white/[0.12]">
                <Phone className="h-[18px] w-[18px] text-cyan" /> {site.phone}
              </a>
            </li>
          </ul>
        </div>
        <div className="bg-paper p-[clamp(24px,3.6vw,48px)] lg:col-span-7 lg:rounded-l-[28px]">
          <p className="text-[20px] font-medium tracking-[-0.02em] text-ink">{t.write}</p>
          <p className="mt-1 text-[15px] text-muted">{t.phone}</p>
          <div className="mt-6">
            <ContactForm compact />
          </div>
        </div>
      </div>
    </section>
  )
}
