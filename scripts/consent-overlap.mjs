/**
 * Overlap check for the cookie banner (Growth spec 2.5.7).
 *
 * Playwright is not a dependency of this repo. Next lists @playwright/test only as a transitive
 * package, and `npm ci` does not install a browser, so this script is not part of `npm test`.
 * To run it:
 *   npm i -D @playwright/test && npx playwright install chromium
 *   npm run dev
 *   node scripts/consent-overlap.mjs
 *
 * First visit, no consent cookie. Viewports from the spec. The banner rectangle must not meet a
 * buy control, the element under the centre of that control must be the control itself, and the
 * sticky-bar button must still navigate.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  try {
    ;({ chromium } = require('@playwright/test'))
  } catch {
    console.error(
      'Playwright is not installed in this repo (not a direct dependency; npm test does not run this script).\n' +
        'Install it with: npm i -D @playwright/test && npx playwright install chromium\n' +
        'Then start the app (npm run dev) and run: node scripts/consent-overlap.mjs',
    )
    process.exit(1)
  }
}

const base = process.env.OVERLAP_BASE ?? 'http://localhost:3000'
const viewports = [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]
const pages = [
  { name: '/products/amber', url: `${base}/products/amber` },
  { name: '/products/calm', url: `${base}/products/calm` },
  { name: 'calm.', url: 'http://calm.localhost:3000/' },
  { name: 'amber.', url: 'http://amber.localhost:3000/' },
  { name: 'focus.', url: 'http://focus.localhost:3000/' },
  { name: '/checkout', url: `${base}/checkout?item=balance-wave` },
]

const browser = await chromium.launch()
const failures = []
try {
  for (const page of pages) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport })
      const tab = await context.newPage()
      const label = `${page.name} @ ${viewport.width}×${viewport.height}`
      try {
        await tab.goto(page.url, { waitUntil: 'networkidle', timeout: 30000 })
        const banner = tab.locator('section.consent')
        if ((await banner.count()) === 0) {
          failures.push(`${label}: cookie banner did not render`)
          continue
        }
        const result = await tab.evaluate(() => {
          const box = (el) => {
            const r = el.getBoundingClientRect()
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
          }
          const bannerEl = document.querySelector('section.consent')
          const targets = [
            ...document.querySelectorAll('[data-buy]'),
            ...document.querySelectorAll('[data-sticky-bar] a, [data-sticky-bar] button'),
            ...[...document.querySelectorAll('header a, header button')].filter((el) => (el.textContent ?? '').trim() === 'Comandă'),
            ...[...document.querySelectorAll('button')].filter((el) => (el.textContent ?? '').trim().startsWith('Plătește')),
          ]
          const seen = new Set()
          const hits = []
          for (const el of targets) {
            if (seen.has(el)) continue
            seen.add(el)
            const b = box(el)
            const a = box(bannerEl)
            const hit = a.width > 1 && b.width > 1 && a.height > 1 && b.height > 1 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
            if (!hit) continue
            const cx = b.left + b.width / 2
            const cy = b.top + b.height / 2
            const top = document.elementFromPoint(cx, cy)
            hits.push({ text: (el.textContent ?? '').trim().slice(0, 80), owns: !!(top && (top === el || el.contains(top))) })
          }
          return { hits }
        })
        for (const hit of result.hits) failures.push(`${label}: banner covers “${hit.text}” (point belongs to control: ${hit.owns})`)
        if (viewport.width < 1024) {
          const sticky = tab.locator('[data-sticky-bar] a, [data-sticky-bar] button').first()
          if (await sticky.count()) {
            const visible = await sticky.isVisible()
            if (visible) {
              await sticky.click({ timeout: 3000 })
              await tab.waitForTimeout(500)
              if (!tab.url().includes('checkout') && !tab.url().includes('#')) failures.push(`${label}: sticky control did not navigate (${tab.url()})`)
            }
          }
        }
      } catch (error) {
        failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        await context.close()
      }
    }
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`No banner overlap on ${pages.length} pages × ${viewports.length} viewports.`)
