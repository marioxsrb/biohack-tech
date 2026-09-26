/**
 * Structured, one-line JSON logs for operations. Pass ids and outcomes, never personal data
 * or secrets: callers log order ids/numbers, not names, emails or addresses.
 */
import 'server-only'

type Level = 'info' | 'warn' | 'error'
type Fields = Record<string, string | number | boolean | null | undefined>

function write(level: Level, event: string, fields: Fields = {}) {
  if (process.env.VITEST && !process.env.LOG_IN_TESTS) return
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...fields })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const log = {
  info: (event: string, fields?: Fields) => write('info', event, fields),
  warn: (event: string, fields?: Fields) => write('warn', event, fields),
  error: (event: string, fields?: Fields) => write('error', event, fields),
}

/** Error text safe to log: first line, bounded, no stack. */
export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).split('\n')[0].slice(0, 300)
