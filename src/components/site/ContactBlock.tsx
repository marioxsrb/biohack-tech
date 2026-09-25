import { Mail, Phone } from '@/components/ui/icons'
import { site, terms } from '@/config/site'

type Props = { title?: string; text?: string }

/** Dark decision block, same pattern as the sibling site: statement left, actions right. */
export function ContactBlock({
  title = 'Nu știi ce să alegi?',
  text = 'Spune-ne ce vrei să îmbunătățești și îți recomandăm produsul potrivit.',
}: Props) {
  return (
    <div className="on-dark rev grid items-center gap-6 rounded-[16px] bg-dark p-8 text-white md:grid-cols-[1fr_auto] md:gap-10 md:py-9 md:pr-9 md:pl-10 max-sm:p-6">
      <div>
        <h2 className="text-[26px] leading-tight tracking-[-0.03em] !text-white max-sm:text-[22px]">{title}</h2>
        <p className="mt-2 max-w-[34em] text-dark-muted">
          {text} Răspundem {terms.responseTime}.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 max-sm:flex-col">
        <a href={`mailto:${site.email}`} className="cta max-sm:w-full">
          <Mail /> Scrie-ne
        </a>
        <a href={site.phoneHref} className="btn2 max-sm:w-full">
          <Phone /> {site.phone}
        </a>
      </div>
    </div>
  )
}
