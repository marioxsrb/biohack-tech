import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import { ADMIN_COOKIE } from '@/lib/admin-auth'
import { FULFIL_COOKIE, fulfilAccess } from '@/lib/fulfillment-auth'

export const metadata: Metadata = { title: { default: 'Fulfillment', template: '%s · Fulfillment Biohack Tech' }, robots: { index: false, follow: false } }

/**
 * The warehouse portal: a slim bar and the work, nothing else of the admin. The proxy and every action check access
 * (lib/fulfillment-auth.ts); this shell only shows who is signed in.
 */
export default async function FulfillmentLayout({ children }: { children: ReactNode }) {
  const c = await cookies()
  const actor = await fulfilAccess(c.get(FULFIL_COOKIE)?.value, c.get(ADMIN_COOKIE)?.value, (await headers()).get('authorization'))
  return (
    <div className="min-h-dvh bg-mist">
      <header className="sticky top-0 z-30 bg-ink text-white">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/fulfillment" className="text-[15px] font-extrabold tracking-[0.04em]">
            BIOHACK <span className="text-cyan-300">TECH</span> <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[12px] font-semibold tracking-normal">Fulfillment</span>
          </Link>
          {actor && (
            <div className="ml-auto flex items-center gap-3 text-[13.5px] text-white/70">
              <span className="max-sm:hidden">{actor.role === 'staff' ? `Depozit · ${actor.user}` : `Admin · ${actor.user}`}</span>
              {actor.role === 'admin' && (
                <Link href="/admin" className="underline underline-offset-4 hover:text-white">
                  Admin
                </Link>
              )}
              <form action="/api/fulfillment/logout" method="post">
                <button className="rounded-full bg-white/10 px-3 py-1.5 text-white hover:bg-white/20">Ieșire</button>
              </form>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 pt-5 pb-16 sm:px-6">{children}</main>
    </div>
  )
}
