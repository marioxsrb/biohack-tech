/** /api/jobs/run: Vercel Cron (GET) and any other scheduler (POST), both only with Bearer $CRON_SECRET. */
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'

const runDueJobs = vi.fn(async () => 3)
vi.mock('@/server/jobs/runner', () => ({ runDueJobs }))
vi.mock('@/server/config', () => ({ getConfig: () => ({ cronSecret: 's3cret-for-tests-only' }) }))
const purgeStaleLeads = vi.fn(async () => 2)
vi.mock('@/server/leads', () => ({ purgeStaleLeads }))
vi.mock('@/server/db', () => ({ getDb: async () => ({}) }))
const { GET, POST } = await import('@/app/api/jobs/run/route')

const req = (method: string, auth?: string) => new NextRequest('https://biohack-tech.ro/api/jobs/run', { method, headers: auth ? { authorization: auth } : {} })

beforeEach(() => {
  runDueJobs.mockClear()
  purgeStaleLeads.mockClear()
})

it.each([
  ['GET', GET],
  ['POST', POST],
])('%s: refuses a missing or wrong secret, runs the batch with the right one', async (method, handler) => {
  expect((await handler(req(method))).status).toBe(401)
  expect((await handler(req(method, 'Bearer wrong'))).status).toBe(401)
  expect(runDueJobs).not.toHaveBeenCalled()
  expect(purgeStaleLeads).not.toHaveBeenCalled()
  const ok = await handler(req(method, 'Bearer s3cret-for-tests-only'))
  expect([ok.status, await ok.json()]).toEqual([200, { ran: 3, purged: 2 }])
  expect(runDueJobs).toHaveBeenCalledWith(50)
  // Leads that never became an order are deleted after the retention period, on every run.
  expect(purgeStaleLeads).toHaveBeenCalledTimes(1)
})
