import { ContactForm } from '@/components/contact/ContactForm'
import { Mail, Phone } from '@/components/ui/icons'
import { site, terms } from '@/config/site'

/** The last section before the footer, kept small: "Nu ești sigur? Întreabă-ne." and the form. */
export function ContactSection() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="wrap scroll-mt-[calc(var(--nav-h)+16px)] py-[var(--sec)]">
      <div className="grid gap-y-8 rounded-[24px] bg-paper p-[clamp(24px,3.6vw,48px)] lg:grid-cols-12 lg:gap-x-10">
        <div className="lg:col-span-5">
          <h2 id="contact-title" className="text-[clamp(30px,3.2vw,42px)] leading-[1.05] tracking-[-0.04em]">
            Nu ești sigur? Întreabă-ne.
          </h2>
          <p className="mt-3 text-[16.5px] leading-relaxed text-text">Te ajutăm să alegi sau răspundem la orice despre o comandă. Îți scriem {terms.responseTime}.</p>
          <ul className="mt-5 space-y-1 text-[15.5px]">
            <li>
              <a href={`mailto:${site.email}`} className="inline-flex min-h-11 items-center gap-3 text-ink hover:text-cyan-700">
                <Mail className="h-[18px] w-[18px] text-muted" /> {site.email}
              </a>
            </li>
            <li>
              <a href={site.phoneHref} className="inline-flex min-h-11 items-center gap-3 text-ink hover:text-cyan-700">
                <Phone className="h-[18px] w-[18px] text-muted" /> {site.phone}
              </a>
            </li>
          </ul>
        </div>
        <div className="lg:col-span-7">
          <ContactForm compact />
        </div>
      </div>
    </section>
  )
}
