import { Phone, WhatsApp } from '@/components/ui/icons'
import { site } from '@/config/site'

/** The WhatsApp message with the product, the chosen variant and quantity already written (as on the product page). */
export function orderWhatsappHref(product: string, variant: string | null, quantity: number) {
  if (!site.whatsapp) return null
  const text = `Bună ziua! Aș dori să plasez o comandă:\n- Produs: ${product}${variant ? `\n- Varianta: ${variant}` : ''}\n- Cantitate: ${quantity}\nMă puteți ajuta să o finalizez?`
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`
}

/**
 * Ordering with a person on a landing, under the checkout button: the phone and WhatsApp side by side, as on the
 * product page (ContactOrder in components/product/BuyBox.tsx), in the landing's colours (--lp-*).
 */
export function LandingContactOrder({ product, variant, quantity, className = '' }: { product: string; variant: string | null; quantity: number; className?: string }) {
  const wa = orderWhatsappHref(product, variant, quantity)
  const btn =
    'flex min-h-[56px] w-full items-center gap-3 rounded-[16px] px-3.5 py-2 text-left shadow-[inset_0_0_0_1px_var(--lp-line)] transition-shadow duration-150 hover:shadow-[inset_0_0_0_1.5px_var(--lp-muted)]'
  const label = (second: string) => (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="text-[12.5px] text-[var(--lp-muted)]">Comandă</span>
      <span className="text-[15px] font-semibold text-[var(--lp-ink)]">{second}</span>
    </span>
  )
  return (
    <div className={`grid gap-2.5 ${wa ? 'grid-cols-2' : ''} ${className}`}>
      <a href={site.phoneHref} aria-label={`Comandă telefonic, ${site.phone}`} className={btn}>
        <Phone className="h-[19px] w-[19px] flex-none text-[var(--lp-accent)]" aria-hidden />
        {label('telefonic')}
        {!wa && <span className="ml-auto text-[14.5px] font-medium whitespace-nowrap text-[var(--lp-muted)] tabular-nums">{site.phone}</span>}
      </a>
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Comandă pe WhatsApp (se deschide WhatsApp)" className={`${btn} hover:!shadow-[inset_0_0_0_1.5px_#25d366]`}>
          <WhatsApp className="h-[20px] w-[20px] flex-none text-[#25d366]" aria-hidden />
          {label('pe WhatsApp')}
        </a>
      )}
    </div>
  )
}
