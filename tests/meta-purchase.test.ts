/** Browser Purchase: lei not bani, the live pixel, and consent that does not drop the event for good. */
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { VENDORS } from '@/lib/consent/vendors'
import { activeMetaPixelId, metaBrowser, metaPhoneDigits, META_PIXEL_ID, purchaseChannels, purchaseLei, RETIRED_META_PIXEL_ID } from '@/lib/meta'

it('reports the order total in lei', () => {
  expect(purchaseLei(638000, 1)).toBe(6380)
  expect(purchaseLei(4000, 5.337)).toBe(213.48)
  expect(purchaseLei(0, 1)).toBe(0)
})

it('uses the live pixel and ignores the retired one', () => {
  expect(META_PIXEL_ID).toBe('967887562483664')
  expect(activeMetaPixelId(undefined)).toBe(META_PIXEL_ID)
  expect(activeMetaPixelId(RETIRED_META_PIXEL_ID)).toBe(META_PIXEL_ID)
  expect(activeMetaPixelId('not-a-pixel')).toBe(META_PIXEL_ID)
  expect(VENDORS.find((v) => v.id === 'meta')?.excludePaths).toBeUndefined()
})

it('keeps Meta Purchase until marketing consent, and does not treat an analytics-only report as sent', () => {
  const base = { legacy: false, gaSent: false, metaSent: false, analytics: false, marketing: false, ga4: true, meta: true, paid: true }
  expect(purchaseChannels(base)).toEqual({ ga4: false, meta: false })
  expect(purchaseChannels({ ...base, analytics: true, paid: false })).toEqual({ ga4: true, meta: false })
  expect(purchaseChannels({ ...base, analytics: true })).toEqual({ ga4: true, meta: false })
  expect(purchaseChannels({ ...base, marketing: true, paid: false })).toEqual({ ga4: false, meta: false })
  expect(purchaseChannels({ ...base, marketing: true })).toEqual({ ga4: false, meta: true })
  // Analytics already reported; the visitor then allows marketing. Purchase still goes to Meta.
  expect(purchaseChannels({ ...base, analytics: true, marketing: true, gaSent: true })).toEqual({ ga4: false, meta: true })
  expect(purchaseChannels({ ...base, marketing: true, metaSent: true })).toEqual({ ga4: false, meta: false })
  expect(purchaseChannels({ ...base, analytics: true, marketing: true, legacy: true })).toEqual({ ga4: false, meta: false })
})

it('reads fbp, fbc, ip and user agent from the checkout request, and builds fbc from fbclid', () => {
  const headers = new Headers({
    cookie: '_fbp=fb.1.1700000000000.1234567890; _ga=1',
    'user-agent': 'Mozilla/5.0 MetaTest',
    'x-forwarded-for': '203.0.113.9, 10.0.0.1',
    host: 'acces.biohack-tech.ro',
  })
  expect(metaBrowser(headers, { fbclid: 'IwAR0abcdefghij', siteHost: 'biohack-tech.ro', now: 1700000000001 })).toEqual({
    fbp: 'fb.1.1700000000000.1234567890',
    fbc: 'fb.1.1700000000001.IwAR0abcdefghij',
    ip: '203.0.113.9',
    ua: 'Mozilla/5.0 MetaTest',
    host: 'acces.biohack-tech.ro',
  })
  expect(metaBrowser(new Headers({ 'x-forwarded-for': '203.0.113.9' }), { siteHost: 'biohack-tech.ro' })).toBeNull()
  expect(metaPhoneDigits('0722 123 456')).toBe('40722123456')
  expect(metaPhoneDigits('+40 722 123 456')).toBe('40722123456')
})

it('Amber landing sends ViewContent', () => {
  expect(readFileSync('src/components/landing/AmberSelector.tsx', 'utf8')).toContain("track('view_item'")
})
