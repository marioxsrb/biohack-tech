/** Admin print documents: A4, behind the admin auth, and the parcel label never pretends to be a courier AWB. */
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const page = readFileSync('src/app/[lang]/(print)/admin/print/page.tsx', 'utf8')

it('offers the four documents and prints on A4', () => {
  for (const d of ['pregatire', 'livrare', 'eticheta', 'detalii']) expect(page).toContain(`${d}:`)
  expect(readFileSync('src/app/globals.css', 'utf8')).toMatch(/@page \{ size: A4/)
})

it('the label says it is internal and shows only an AWB entered by a person', () => {
  expect(page).toMatch(/Etichetă internă · nu este AWB/)
  expect(page).toMatch(/o\.courier && o\.trackingNumber \? `\$\{o\.courier\} · AWB \$\{o\.trackingNumber\}` : 'AWB: de la curier'/)
  expect(page).not.toMatch(/Math\.random|randomUUID|generateAwb/i)
})

it('lives under /admin, so the proxy’s admin auth covers it', () => {
  expect(page).toContain("PageProps<'/[lang]/admin/print'>")
  expect(readFileSync('src/proxy.ts', 'utf8')).toMatch(/path === '\/admin' \|\| path\.startsWith\('\/admin\/'\)/)
})
