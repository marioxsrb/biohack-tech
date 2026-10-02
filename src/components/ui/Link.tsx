'use client'

import NextLink from 'next/link'
import type { ComponentProps } from 'react'
import { useLocalePath } from '@/i18n/LocaleProvider'

/**
 * next/link that keeps the visitor in their language: an internal path ('/cart') becomes '/en/cart' on
 * the English site. External links, anchors and full URLs pass through unchanged.
 */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const to = useLocalePath()
  return <NextLink href={typeof href === 'string' ? to(href) : href} {...props} />
}
