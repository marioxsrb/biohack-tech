/**
 * TBI Fusion Pay UAT check, run by hand only (nothing here touches production, GHL or the store):
 *   TBI_UAT_LIVE=1 TBI_UAT_RESELLER_CODE=… TBI_UAT_RESELLER_KEY=… TBI_TEST_ENCRYPTION_KEY=… npx vitest run tests/manual/tbi-uat-live.test.ts
 * With TBI's UAT test credentials from the documentation (never in git) against https://ro.tbi-uat.online/api: GetCalculations, then a fictitious RegisterApplication
 * (order id "BT-UAT-…", test customer) and GetApplicationStatus for it. Prints the scheme list and the URL to open.
 * TBI_UAT_CATEGORY: the category id for the test items (default 7, the value in TBI's own UAT example).
 */
import { describe, expect, it } from 'vitest'
import { getApplicationStatus, getCalculations, quoteSchemes, registerApplication } from '@/lib/tbi/client'
import type { TbiConfig } from '@/server/config'

const live = process.env.TBI_UAT_LIVE === '1' && !!process.env.TBI_UAT_RESELLER_CODE && !!process.env.TBI_UAT_RESELLER_KEY && !!process.env.TBI_TEST_ENCRYPTION_KEY
const cfg: TbiConfig = {
  resellerCode: process.env.TBI_UAT_RESELLER_CODE ?? '',
  resellerKey: process.env.TBI_UAT_RESELLER_KEY ?? '',
  encryptionKey: process.env.TBI_TEST_ENCRYPTION_KEY ?? '',
  apiBase: 'https://ro.tbi-uat.online/api',
  env: 'uat',
  webhookSecret: null,
  categoryId: Number(process.env.TBI_UAT_CATEGORY ?? 7),
  publicBase: 'https://biohack-tech.vercel.app',
}

describe.skipIf(!live)('TBI Fusion Pay UAT (manual)', () => {
  it('GetCalculations, RegisterApplication and GetApplicationStatus answer', async () => {
    const { schemes } = await getCalculations(cfg, { force: true })
    console.log('schemes', JSON.stringify(schemes, null, 1))
    expect(schemes.length).toBeGreaterThan(0)
    console.log('quote 3900', JSON.stringify(quoteSchemes(schemes, 3900)))

    const orderid = `BT-UAT-${Date.now()}`
    const reg = await registerApplication(cfg, {
      orderid,
      firstname: 'Test',
      lastname: 'Biohack',
      email: 'test@tbibank.ro',
      phone: '0777777777',
      items: [{ name: 'NEUROS Calm', qty: 1, price: 3900, sku: 'calm', category: cfg.categoryId!, imagelink: 'https://cdn.shopify.com/s/files/1/1095/8431/8795/files/cutie-deschidere_87f63c7a-844b-4064-93f7-f223b597308a.webp?v=1792593931' }],
      statusURL: process.env.TBI_UAT_STATUS_URL ?? '',
      successRedirectURL: 'https://biohack-tech.vercel.app/api/tbi/result?r=ok',
      failRedirectURL: 'https://biohack-tech.vercel.app/api/tbi/result?r=fail',
    })
    console.log('registered', orderid, JSON.stringify(reg))
    expect(reg.url).toMatch(/^https:\/\//)
    const st = await getApplicationStatus(cfg, reg.order_id, reg.token)
    console.log('status', JSON.stringify(st))
    expect(st.store_order_id).toBe(orderid)
  }, 60_000)
})
