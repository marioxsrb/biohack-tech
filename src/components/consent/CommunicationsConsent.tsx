import {
  COMMUNICATIONS_CONSENT_TEXT,
  COMMUNICATIONS_CONSENT_TEXT_EN,
  COMMUNICATIONS_LINK_TEXT,
  COMMUNICATIONS_LINK_TEXT_EN,
  COMMUNICATIONS_TERMS_HREF,
  EMAIL_ONLY_CONSENT_TEXT,
  EMAIL_ONLY_CONSENT_TEXT_EN,
} from '@/lib/consent/communications'

/**
 * The one optional communications box in the checkout: never ticked by
 * default, its words open the conditions in the terms, and "(opțional)" stays discreet. Ticking it is one
 * decision that the server records as two consents (email and AI calls), because the text names both.
 */
export function CommunicationsConsent({ checked, onChange, locale = 'ro', emailOnly = false, className = '' }: { checked: boolean; onChange: (v: boolean) => void; locale?: 'ro' | 'en'; emailOnly?: boolean; className?: string }) {
  const en = locale === 'en'
  // The international site has no AI calls: its box names email only.
  const text = emailOnly ? (en ? EMAIL_ONLY_CONSENT_TEXT_EN : EMAIL_ONLY_CONSENT_TEXT) : en ? COMMUNICATIONS_CONSENT_TEXT_EN : COMMUNICATIONS_CONSENT_TEXT
  const link = en ? COMMUNICATIONS_LINK_TEXT_EN : COMMUNICATIONS_LINK_TEXT
  const [before, after] = text.split(link)
  return (
    <label className={`flex cursor-pointer items-start gap-3 leading-snug text-text ${className}`}>
      <input
        type="checkbox"
        name="communicationsConsent"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 flex-none accent-[var(--color-ink)]"
      />
      <span>
        {before}
        <a href={`${en ? '/en' : ''}${COMMUNICATIONS_TERMS_HREF}`} target="_blank" rel="noopener" className="font-medium text-ink underline underline-offset-4">
          {link}
        </a>
        {after} <span className="whitespace-nowrap text-[12px] text-[#b9c2c6]">{en ? '(optional)' : '(opțional)'}</span>
      </span>
    </label>
  )
}
