'use client'

/**
 * Before the 10% offer on the NEUROS Focus pages: a tiny tap-to-fly game. Get the bird through one gap and it flies
 * on by itself, while the window asks what it would be like to play the same game without touching the screen,
 * only with your attention (what NEUROS Focus does with Neuros Game). Then the gift (the 10% window) opens.
 */
import { useEffect, useRef, useState } from 'react'

import { Close } from '@/components/ui/icons'

// The game is drawn at this size and scaled to the window.
const W = 480
const H = 560
const GROUND = 70
const GAP = 190
const PIPE_W = 82
const BIRD_X = 130
const R = 17
const GRAVITY = 0.42
const FLAP = -7.6
const SPEED = 2.6

type Phase = 'ready' | 'play' | 'crash' | 'won'

export function FocusGate({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const phaseRef = useRef<Phase>('ready')
  const flapRef = useRef<() => void>(() => {})

  useEffect(() => {
    const c = canvas.current!
    const ctx = c.getContext('2d')!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = W * dpr
    c.height = H * dpr
    ctx.scale(dpr, dpr)

    const go = (p: Phase) => {
      phaseRef.current = p
      setPhase(p)
    }
    // The first gap sits a little above the middle; after the win the pipes keep coming for the autopilot.
    const gapY = (i: number) => (i === 0 ? 230 : 170 + ((i * 97) % 200))
    let bird = { y: 250, v: 0 }
    let pipes = [{ x: W + 40, gap: gapY(0), i: 0 }]
    let t = 0
    let raf = 0
    let attention = 0

    const reset = () => {
      bird = { y: 250, v: 0 }
      pipes = [{ x: W + 40, gap: gapY(0), i: 0 }]
    }
    flapRef.current = () => {
      const p = phaseRef.current
      if (p === 'won') return
      if (p === 'ready' || p === 'crash') {
        if (p === 'crash') reset()
        go('play')
      }
      bird.v = FLAP
    }

    const cloud = (x: number, y: number, s: number) => {
      ctx.beginPath()
      ctx.arc(x, y, 18 * s, 0, Math.PI * 2)
      ctx.arc(x + 22 * s, y - 8 * s, 22 * s, 0, Math.PI * 2)
      ctx.arc(x + 46 * s, y, 17 * s, 0, Math.PI * 2)
      ctx.fill()
    }

    const draw = () => {
      const p = phaseRef.current
      t++
      // Sky, clouds, ground.
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#0e2a33')
      sky.addColorStop(1, '#1d6b7a')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      for (let k = 0; k < 4; k++) cloud(((k * 170 - t * 0.4) % (W + 200) + W + 200) % (W + 200) - 100, 90 + k * 55, 1 + (k % 2) * 0.4)

      // Physics.
      if (p === 'play') {
        bird.v += GRAVITY
        bird.y += bird.v
      } else if (p === 'won') {
        // Autopilot: the bird glides towards the next gap, as if steered by attention.
        const next = pipes.find((q) => q.x + PIPE_W > BIRD_X - R) ?? pipes[pipes.length - 1]
        bird.v += (next.gap - bird.y) * 0.004 - bird.v * 0.12
        bird.y += bird.v
        attention = Math.min(1, attention + 0.01)
      } else if (p === 'ready') {
        bird.y = 250 + Math.sin(t / 14) * 8
      }
      if (p === 'play' || p === 'won') {
        for (const q of pipes) q.x -= SPEED
        if (pipes[pipes.length - 1].x < W - 230) {
          const i = pipes[pipes.length - 1].i + 1
          pipes.push({ x: W + 20, gap: gapY(i), i })
        }
        pipes = pipes.filter((q) => q.x > -PIPE_W - 10)
      }

      // Pipes.
      for (const q of pipes) {
        const g = ctx.createLinearGradient(q.x, 0, q.x + PIPE_W, 0)
        g.addColorStop(0, '#2fb8a5')
        g.addColorStop(0.5, '#5fe0cc')
        g.addColorStop(1, '#22917f')
        ctx.fillStyle = g
        const top = q.gap - GAP / 2
        const bottom = q.gap + GAP / 2
        ctx.beginPath()
        ctx.roundRect(q.x, -20, PIPE_W, top + 20, 10)
        ctx.roundRect(q.x, bottom, PIPE_W, H - GROUND - bottom + 20, 10)
        ctx.fill()
        ctx.fillStyle = '#1c7d6e'
        ctx.beginPath()
        ctx.roundRect(q.x - 6, top - 22, PIPE_W + 12, 22, 7)
        ctx.roundRect(q.x - 6, bottom, PIPE_W + 12, 22, 7)
        ctx.fill()
      }

      // Ground.
      ctx.fillStyle = '#0b1f25'
      ctx.fillRect(0, H - GROUND, W, GROUND)
      ctx.fillStyle = '#2fb8a5'
      ctx.fillRect(0, H - GROUND, W, 4)

      // The bird.
      const tilt = Math.max(-0.5, Math.min(1.1, bird.v / 10))
      ctx.save()
      ctx.translate(BIRD_X, bird.y)
      ctx.rotate(tilt)
      if (p === 'won') {
        // The attention glow around it.
        ctx.fillStyle = `rgba(95,224,204,${0.18 + attention * 0.22 + Math.sin(t / 8) * 0.06})`
        ctx.beginPath()
        ctx.arc(0, 0, R + 12 + Math.sin(t / 8) * 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#ffd23f'
      ctx.beginPath()
      ctx.arc(0, 0, R, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#f5a300'
      ctx.beginPath()
      ctx.ellipse(-4, 4 + Math.sin(t / 3) * 3, 10, 6, -0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(7, -6, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#0b1f25'
      ctx.beginPath()
      ctx.arc(9, -6, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ff7a3d'
      ctx.beginPath()
      ctx.moveTo(15, -1)
      ctx.lineTo(27, 3)
      ctx.lineTo(15, 8)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // Collisions and the win (the first gap passed).
      if (p === 'play') {
        const first = pipes[0]
        const inX = BIRD_X + R > first.x && BIRD_X - R < first.x + PIPE_W
        const hitPipe = inX && (bird.y - R < first.gap - GAP / 2 || bird.y + R > first.gap + GAP / 2)
        if (hitPipe || bird.y + R > H - GROUND || bird.y - R < -40) go('crash')
        else if (first.i === 0 && BIRD_X - R > first.x + PIPE_W) go('won')
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        flapRef.current()
      }
    }
    window.addEventListener('keydown', key)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', key)
    }
  }, [])

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="focus-gate-title" className="relative w-full max-w-[460px] overflow-hidden rounded-[24px] bg-ink shadow-[0_40px_100px_-30px_rgba(0,0,0,.6)]">
      <button type="button" onClick={onClose} aria-label="Închide" className="absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25">
        <Close className="h-4 w-4" />
      </button>
      <div className="relative">
        <canvas
          ref={canvas}
          onPointerDown={(e) => {
            e.preventDefault()
            flapRef.current()
          }}
          className="block aspect-[480/560] max-h-[78svh] w-full touch-none select-none"
          aria-label="Joc: atinge ca pasărea să zboare printre obstacole"
        />

        {phase !== 'won' && (
          <div className="pointer-events-none absolute inset-x-0 top-0 p-6 pr-16">
            <h2 id="focus-gate-title" className="text-[clamp(24px,6vw,30px)] leading-[1.05] font-semibold tracking-[-0.03em] !text-white text-balance">
              Treci pasărea de primul obstacol.
            </h2>
            <p className="mt-2 text-[15px] leading-snug text-white/80">Atinge ecranul ca să zboare. Dacă reușești, te așteaptă un cadou.</p>
          </div>
        )}
        {phase === 'ready' && (
          <p className="pointer-events-none absolute inset-x-0 bottom-[96px] mx-auto w-fit animate-pulse rounded-full bg-white/15 px-4 py-2 text-[15px] font-semibold text-white backdrop-blur">Atinge ca să începi</p>
        )}
        {phase === 'crash' && (
          <p className="pointer-events-none absolute inset-x-0 bottom-[96px] mx-auto w-fit rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-ink">Aproape! Atinge și încearcă din nou</p>
        )}

        {phase === 'won' && (
          <div className="absolute inset-x-0 top-0 bg-[linear-gradient(180deg,rgba(8,17,19,.9)_0%,rgba(8,17,19,.75)_70%,rgba(8,17,19,0)_100%)] p-6 pr-16 pb-10">
            <p className="text-[13px] font-semibold tracking-[0.12em] text-[#5fe0cc] uppercase">Ai reușit</p>
            <h2 id="focus-gate-title" className="mt-1.5 text-[clamp(23px,5.6vw,28px)] leading-[1.08] font-semibold tracking-[-0.03em] !text-white text-balance">
              Acum imaginează-ți același joc fără să atingi ecranul. Doar cu atenția ta.
            </h2>
            <p className="mt-2 text-[15px] leading-snug text-white/80">Cu NEUROS Focus, pasărea zboară când ești concentrat. Așa se antrenează atenția, jucându-te.</p>
          </div>
        )}
        {phase === 'won' && (
          <div className="absolute inset-x-0 bottom-0 p-5">
            <button type="button" onClick={onDone} className="cta w-full">
              Primește cadoul
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
