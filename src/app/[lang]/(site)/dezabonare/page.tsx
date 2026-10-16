import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { PRIVATE_PAGES, TOKEN_RE } from '@/lib/private-links'
import UnsubscribePage from './[token]/page'

export { metadata } from './[token]/page'

/**
 * The private page at its token-free address: the link's token was moved into an HttpOnly cookie by the proxy
 * (lib/private-links.ts), so the address that analytics, ad tools and the Referer see carries no secret.
 */
export default async function Page({ params, searchParams }: PageProps<'/[lang]/dezabonare'>) {
  const token = (await cookies()).get(PRIVATE_PAGES.dezabonare.cookie)?.value ?? ''
  if (!TOKEN_RE.test(token)) notFound()
  const { lang } = await params
  return UnsubscribePage({ params: Promise.resolve({ lang, token }), searchParams } as PageProps<'/[lang]/dezabonare/[token]'>)
}
