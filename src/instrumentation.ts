/**
 * Server start: report configuration problems once, and run the job queue every minute
 * in long-running Node deployments (Railway, Render, a VPS). On Vercel (VERCEL=1) the timer is
 * off: Vercel Cron calls /api/jobs/run (vercel.json), and work after a request runs via after().
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { loadConfig } = await import('@/server/config')
  const { log } = await import('@/server/log')
  const { config, issues } = loadConfig()
  for (const i of issues) log[i.level === 'error' ? 'error' : 'warn']('config.issue', { area: i.area, message: i.message })
  log.info('app.start', { env: config.appEnv, stripe: !!config.stripe, bank: !!config.bank, fgo: !!config.fgo, ghl: !!config.ghl, email: config.email.transport, db: config.databaseUrl ? 'postgres' : config.localDb ? 'local' : 'none' })
  if (process.env.JOBS_INTERVAL === 'off' || process.env.VERCEL === '1' || (!config.databaseUrl && !config.localDb)) return
  const { runDueJobs } = await import('@/server/jobs/runner')
  setInterval(() => void runDueJobs(), 60_000).unref()
}
