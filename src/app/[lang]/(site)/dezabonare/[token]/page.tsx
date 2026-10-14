import type { Metadata } from 'next'
import Link from '@/components/ui/Link'
import { connection } from 'next/server'
import { Check } from '@/components/ui/icons'
import { site } from '@/config/site'
import { getDb } from '@/server/db'
import { marketing } from '@/server/marketing/consent'
import { unsubscribeAction } from './actions'

export const metadata: Metadata = { title: 'Dezabonare', robots: { index: false, follow: false } }

const mask = (email: string) => email.replace(/^(.)[^@]*(@.*)$/, '$1•••$2')

/**
 * The unsubscribe link from marketing emails. Opening the link changes nothing (mail scanners open links
 * too); one button confirms. Order emails keep coming: they are not marketing.
 */
export default async function UnsubscribePage({ params, searchParams }: PageProps<'/[lang]/dezabonare/[token]'>) {
  await connection()
  const { token } = await params
  const done = (await searchParams).gata === '1'
  let email: string | null = null
  let subscribed = false
  try {
    const db = await getDb()
    email = await marketing.emailForToken(db, token)
    subscribed = !!email && !!(await marketing.state(db, email))?.granted
  } catch {}

  return (
    <section className="pt-[calc(var(--nav-h)+56px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+28px)]">
      <div className="wrap max-w-[640px]">
        {!email ? (
          <>
            <h1 className="text-[clamp(28px,3.4vw,38px)] leading-tight tracking-[-0.035em]">Linkul nu mai este valid.</h1>
            <p className="sub mt-4">
              Scrie-ne la{' '}
              <a href={`mailto:${site.email}`} className="font-medium text-ink underline underline-offset-4">
                {site.email}
              </a>{' '}
              și te scoatem noi din lista de emailuri de marketing.
            </p>
          </>
        ) : subscribed ? (
          <>
            <h1 className="text-[clamp(28px,3.4vw,38px)] leading-tight tracking-[-0.035em]">Te dezabonezi de la emailurile de marketing?</h1>
            <p className="sub mt-4">
              Nu mai primești noutăți, oferte, recomandări sau mementouri pentru comenzi nefinalizate pe {mask(email)}, iar asistentul nostru AI nu te mai sună.
            </p>
            <p className="mt-3 text-[15.5px] text-text">Emailurile despre comenzile tale (confirmare, plată, factură, livrare) vin în continuare.</p>
            <form action={unsubscribeAction} className="mt-8">
              <input type="hidden" name="token" value={token} />
              <button className="cta">Da, mă dezabonez</button>
            </form>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
              <Check className="h-6 w-6" />
            </span>
            <h1 className="mt-6 text-[clamp(28px,3.4vw,38px)] leading-tight tracking-[-0.035em]">
              {done ? 'Te-ai dezabonat.' : 'Nu primești emailuri de marketing de la noi.'}
            </h1>
            <p className="sub mt-4">
              Pe {mask(email)} primești doar emailurile despre comenzile tale. Dacă te răzgândești, bifează acordul la următoarea comandă.
            </p>
            <Link href="/" className="tlink mt-8">
              Înapoi la site
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
