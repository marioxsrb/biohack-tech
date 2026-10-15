/**
 * A SHA-256 of signals that stay the same across the browsers of one device (screen, pixel ratio, colour depth,
 * time zone, language, platform, touch), so a device that already gave its details on the price form is
 * recognised in another browser, an in-app browser or a private window. Only the hash leaves the browser; the
 * server keeps an HMAC of it with the network address (server/device.ts), so identical phones elsewhere never
 * match. Browser only.
 */
export async function deviceHash(): Promise<string | null> {
  try {
    const [w, h] = [screen.width, screen.height].sort((a, b) => a - b)
    const parts = [
      `${w}x${h}x${screen.colorDepth}`,
      String(Math.round(devicePixelRatio * 100)),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      (navigator.language || '').slice(0, 2).toLowerCase(),
      (navigator as Navigator & { platform?: string }).platform ?? '',
      String(navigator.maxTouchPoints ?? 0),
    ]
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('|')))
    return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

/** Where the device keeps its unlocked lead id, beside the cookie (a cleared cookie alone does not lock it again). */
export const GATE_STORAGE_KEY = 'bt-gate2'
