import Image from 'next/image'
import { ContactForm } from '@/components/contact/ContactForm'
import { Mail, Phone } from '@/components/ui/icons'
import { site, terms } from '@/config/site'
import consult from '@/assets/img/brain-flow/consultatie.webp'

/** The last section before the footer: a person to talk to, and the form. */
export function ContactSection() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="scroll-mt-[calc(var(--nav-h)+16px)] py-[var(--sec)]">
      <div className="wrap">
        <div className="grid overflow-hidden rounded-[32px] bg-paper md:grid-cols-12">
          <div className="relative flex flex-col justify-end md:col-span-5 max-md:min-h-[360px]">
            <Image src={consult} alt="Specialistă Biohack Tech arătând unei cliente un program pe tabletă" fill placeholder="blur" sizes="(min-width: 768px) 480px, 100vw" className="object-cover object-[30%_50%]" />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(0deg,rgb(8_17_19/.94),rgb(8_17_19/.78)_48%,rgb(8_17_19/.15)_82%,transparent)] max-md:bg-[linear-gradient(0deg,rgb(8_17_19/.95),rgb(8_17_19/.72))]" />
            <div className="on-dark relative p-[clamp(24px,3.4vw,40px)] text-white">
              <p className="text-[14px] font-semibold tracking-[0.12em] text-cyan uppercase">Contact</p>
              <h2 id="contact-title" className="mt-2 text-[clamp(34px,4vw,54px)] leading-[1] tracking-[-0.045em] !text-white">
                Hai să vorbim.
              </h2>
              <p className="mt-3 max-w-[26em] text-[16.5px] leading-relaxed text-white/85">
                O recomandare, o întrebare despre comandă sau ajutor după ce ai primit produsul. Îți răspundem {terms.responseTime}.
              </p>
              <ul className="mt-5 space-y-1 text-[16px]">
                <li>
                  <a href={`mailto:${site.email}`} className="inline-flex min-h-11 items-center gap-3 text-white hover:text-cyan">
                    <Mail className="h-[18px] w-[18px] text-white/70" /> {site.email}
                  </a>
                </li>
                <li>
                  <a href={site.phoneHref} className="inline-flex min-h-11 items-center gap-3 text-white hover:text-cyan">
                    <Phone className="h-[18px] w-[18px] text-white/70" /> {site.phone}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="p-[clamp(24px,4.4vw,56px)] md:col-span-7">
            <p className="text-[22px] tracking-[-0.02em] text-ink">Scrie-ne aici</p>
            <p className="mt-1 text-[15.5px] text-muted">Toate câmpurile, în afară de telefon, sunt necesare.</p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
