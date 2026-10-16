import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { PRIVATE_PAGES, TOKEN_RE } from '@/lib/private-links'
import ResumePage from './[token]/page'

export { metadata } from './[token]/page'

/**
 * The private page at its token-free address: the link's token was moved into an HttpOnly cookie by the proxy
 * (lib/private-links.ts), so the address that analytics, ad tools and the Referer see carries no secret.
 */
export default async function Page({ params, searchParams }: PageProps<'/[lang]/reluare'>) {
  const token = (await cookies()).get(PRIVATE_PAGES.reluare.cookie)?.value ?? ''
  if (!TOKEN_RE.test(token)) notFound()
  const { lang } = await params
  return ResumePage({ params: Promise.resolve({ lang, token }), searchParams } as PageProps<'/[lang]/reluare/[token]'>)
}
