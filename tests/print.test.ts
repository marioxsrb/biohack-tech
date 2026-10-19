/** Admin print documents: A4, behind the admin auth, and the parcel label never pretends to be a courier AWB. */
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const page = readFileSync('src/components/print/OrderDocuments.tsx', 'utf8')

it('offers the four documents and prints on A4', () => {
  for (const d of ['pregatire', 'livrare', 'eticheta', 'detalii']) expect(page).toContain(`${d}:`)
  expect(readFileSync('src/app/globals.css', 'utf8')).toMatch(/@page \{ size: A4/)
})

it('the label says it is internal and shows only an AWB entered by a person', () => {
  expect(page).toMatch(/Etichetă internă · nu este AWB/)
  expect(page).toMatch(/o\.courier && o\.trackingNumber \? `\$\{o\.courier\} · AWB \$\{o\.trackingNumber\}` : 'AWB: de la curier'/)
  expect(page).not.toMatch(/Math\.random|randomUUID|generateAwb/i)
})

it('lives under /admin and /fulfillment, so the proxy’s auth covers both; the warehouse copy hides order values', () => {
  expect(readFileSync('src/app/[lang]/(print)/admin/print/page.tsx', 'utf8')).toContain("PageProps<'/[lang]/admin/print'>")
  const portal = readFileSync('src/app/[lang]/(print)/fulfillment/print/page.tsx', 'utf8')
  expect(portal).toContain("PageProps<'/[lang]/fulfillment/print'>")
  expect(portal).toContain('restricted')
  const proxy = readFileSync('src/proxy.ts', 'utf8')
  expect(proxy).toMatch(/path === '\/admin' \|\| path\.startsWith\('\/admin\/'\)/)
  expect(proxy).toMatch(/path === '\/fulfillment' \|\| path\.startsWith\('\/fulfillment\/'\)/)
})
