/**
 * Private links (order page, cart recovery, unsubscribe) carry a secret token. The token must never stay in the
 * browser's address bar: analytics and ad tools (Meta Pixel, Google Analytics, Clarity) read the page address,
 * and the Referer header carries it to every third party the page loads. So the first request of such a link
 * moves the token into an HttpOnly cookie and redirects to the same page without it (/comanda, /reluare,
 * /dezabonare); the page reads the token from the cookie. Links already sent by email keep working.
 */
export const PRIVATE_PAGES = {
  comanda: { cookie: 'bt_tok_comanda', days: 60, keep: ['redirect_status'] },
  reluare: { cookie: 'bt_tok_reluare', days: 7, keep: [] as string[] },
  dezabonare: { cookie: 'bt_tok_dezabonare', days: 30, keep: ['gata'] },
} as const
export type PrivatePage = keyof typeof PRIVATE_PAGES

const LINK = /^\/(?:(ro|en)\/)?(comanda|reluare|dezabonare)\/([\w-]{20,64})\/?$/

/** A private link with its token, or null: the page, the language prefix and the token. */
export function privateLink(pathname: string): { page: PrivatePage; en: boolean; token: string } | null {
  const m = LINK.exec(pathname)
  return m ? { page: m[2] as PrivatePage, en: m[1] === 'en', token: m[3] } : null
}

/** The token-free address the link redirects to, with only the query parameters the page needs. */
export function tokenFreeUrl(link: { page: PrivatePage; en: boolean }, search: URLSearchParams): string {
  const kept = new URLSearchParams()
  for (const k of PRIVATE_PAGES[link.page].keep) {
    const v = search.get(k)
    if (v && /^[\w-]{1,32}$/.test(v)) kept.set(k, v)
  }
  const q = kept.toString()
  return `${link.en ? '/en' : ''}/${link.page}${q ? `?${q}` : ''}`
}

export const TOKEN_RE = /^[\w-]{20,64}$/
