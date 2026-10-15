/**
 * The chat greeting's notification sounds, synthesised in the browser (Web Audio, no files). The admin picks one in
 * /admin/setari (store setting `chatSound`, with a preview button); the website plays it when the greeting bubble
 * appears. Dependency-free and browser-only at call time.
 */
export const CHAT_SOUNDS = {
  ping: { label: 'Ping (implicit)', hint: 'Două note luminoase, cu ecou ușor, lung' },
  note: { label: 'Notă iMessage', hint: 'Trei note scurte, urcătoare, ca o notificare de mesaj' },
  soft: { label: 'Discret', hint: 'Două note joase, blânde' },
  bell: { label: 'Clopoțel', hint: 'O notă de clopoțel care se stinge lent' },
  pop: { label: 'Pop', hint: 'Un „pop” scurt, ca o bulă' },
  off: { label: 'Fără sunet', hint: 'Bula apare fără sunet' },
} as const
export type ChatSound = keyof typeof CHAT_SOUNDS
export const isChatSound = (v: unknown): v is ChatSound => typeof v === 'string' && Object.prototype.hasOwnProperty.call(CHAT_SOUNDS, v)

type Preset = { notes: [freq: number, at: number, len: number][]; partials: [mult: number, level: number][]; echo: boolean; gain: number; sweep?: number }

const PRESETS: Record<Exclude<ChatSound, 'off'>, Preset> = {
  ping: { notes: [[1318.5, 0, 0.55], [1975.5, 0.12, 1.7]], partials: [[1, 0.5], [2.76, 0.12]], echo: true, gain: 0.55 },
  note: { notes: [[1046.5, 0, 0.22], [1318.5, 0.085, 0.22], [1568, 0.17, 1.1]], partials: [[1, 0.5], [2, 0.08]], echo: false, gain: 0.5 },
  soft: { notes: [[784, 0, 0.6], [1046.5, 0.13, 1.2]], partials: [[1, 0.5]], echo: false, gain: 0.45 },
  bell: { notes: [[1760, 0, 2.3]], partials: [[1, 0.45], [2.76, 0.18], [5.4, 0.06]], echo: true, gain: 0.5 },
  pop: { notes: [[420, 0, 0.16]], partials: [[1, 0.6]], echo: false, gain: 0.6, sweep: 2.2 },
}

/** Plays the sound on an audio context that is already running. */
export function playChatSound(ctx: AudioContext, sound: ChatSound) {
  if (sound === 'off') return
  const p = PRESETS[sound]
  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.value = p.gain
  master.connect(ctx.destination)
  if (p.echo) {
    const echo = ctx.createDelay()
    echo.delayTime.value = 0.16
    const feedback = ctx.createGain()
    feedback.gain.value = 0.3
    master.connect(echo).connect(feedback).connect(echo)
    feedback.connect(ctx.destination)
  }
  for (const [freq, at, len] of p.notes) {
    for (const [mult, level] of p.partials) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq * mult, now + at)
      if (p.sweep) osc.frequency.exponentialRampToValueAtTime(freq * mult * p.sweep, now + at + len * 0.6)
      gain.gain.setValueAtTime(0, now + at)
      gain.gain.linearRampToValueAtTime(level, now + at + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + len)
      osc.connect(gain).connect(master)
      osc.start(now + at)
      osc.stop(now + at + len + 0.05)
    }
  }
}

/** A new audio context, or null when the browser has none. */
export function newAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const Ctx = W.AudioContext ?? W.webkitAudioContext
  return Ctx ? new Ctx() : null
}
