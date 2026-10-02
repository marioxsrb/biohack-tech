'use client'

import Link from '@/components/ui/Link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'
import { useLocalePath } from '@/i18n/LocaleProvider'
import { attributionParams } from '@/lib/attribution'

/**
 * A link between cart and checkout that keeps the landing and campaign parameters of the current URL
 * (lp, lp_host, utm_*). Attribution is never stored in the browser, so it travels only in the URL; this
 * keeps it on landing → checkout → cart → checkout. The parameters are read at click time, when the
 * address bar is certainly the current page's.
 */
export function CarryLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter()
  const to = useLocalePath()
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        const q = attributionParams(window.location.search).toString()
        if (!q) return
        e.preventDefault()
        router.push(`${to(href)}${href.includes('?') ? '&' : '?'}${q}`)
      }}
      {...rest}
    />
  )
}
