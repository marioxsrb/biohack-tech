'use client'

/**
 * NEUROS Amber, live try-on: the front camera with the chosen frame drawn over the eyes, like a filter. The face is
 * tracked in the browser (MediaPipe Face Landmarker, its WebAssembly and model served from /public/mediapipe); no
 * frame of the video leaves the device and nothing is stored. The overlays (public/tryon/<frame>-<lens>.webp) are
 * the studio front shots with see-through lenses. Loaded only when the visitor opens it.
 */
import Image, { type StaticImageData } from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'

import { useCart } from '@/components/cart/CartProvider'
import { cartStore, lineKey } from '@/components/cart/cart-store'
import Link from '@/components/ui/Link'
import type { ProductId } from '@/content/catalog'
import iconCat from '@/assets/img/glasses/cat-eye-negru-1.webp'
import iconSq from '@/assets/img/glasses/patrat-negru-1.webp'
import iconSub from '@/assets/img/glasses/subtire-negru-1.webp'

const AMBER: ProductId = 'ochelari-biohack'

/** The three models, each with the frame colours it is made in (frame id = model-colour). */
const MODELS: { id: string; label: string; icon: StaticImageData; colours: string[] }[] = [
  { id: 'cat-eye', label: 'Cat eye', icon: iconCat, colours: ['negru', 'bej'] },
  { id: 'patrat', label: 'Unisex pătrat', icon: iconSq, colours: ['negru', 'maro'] },
  { id: 'subtire', label: 'Ramă subțire', icon: iconSub, colours: ['negru'] },
]
const COLOURS: Record<string, { label: string; swatch: string }> = {
  negru: { label: 'Negru', swatch: '#15181A' },
  bej: { label: 'Bej', swatch: '#C9A193' },
  maro: { label: 'Maro', swatch: '#6B4A36' },
}
const LENS_LABEL = { galben: 'galbene', rosu: 'roșii' } as const
/** How wide each frame sits, as a share of the face width between the temples (cat eye is wider). */
const FIT: Record<string, number> = { 'cat-eye-negru': 1.08, 'cat-eye-bej': 1.08, 'patrat-negru': 1.02, 'patrat-maro': 1.02, 'subtire-negru': 1.0 }

type Lens = 'galben' | 'rosu'
type Status = 'loading' | 'live' | 'denied' | 'error'

// Face mesh points: outer eye corners, the bridge of the nose, the two temples.
const EYE_R = 33
const EYE_L = 263
const BRIDGE = 168
const TEMPLE_R = 127
const TEMPLE_L = 356

/**
 * Pairs added from the try-on stay listed while the window is open: the visitor keeps trying, and the button offers
 * to add the next configuration too. The other lens of a frame already added becomes the pachet (both pairs, 20%).
 */
type Added = { id: string; label: string }

export function AmberTryOn({ frame: initialFrame, lens: initialLens, onClose }: { frame: string; lens: Lens; onClose: () => void }) {
  const start = MODELS.find((m) => initialFrame.startsWith(`${m.id}-`)) ?? MODELS[0]
  const [model, setModel] = useState(start.id)
  const [colour, setColour] = useState(start.colours.find((c) => initialFrame === `${start.id}-${c}`) ?? start.colours[0])
  const frame = `${model}-${colour}`
  const [added, setAdded] = useState<Added[]>([])
  const { addMany } = useCart()
  const [lens, setLens] = useState<Lens>(initialLens)
  const [status, setStatus] = useState<Status>('loading')
  const [face, setFace] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const overlay = useRef<HTMLImageElement | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  // Read by the drawing loop, so changing the frame does not restart the camera.
  const frameRef = useRef(frame)
  useEffect(() => {
    frameRef.current = frame
  }, [frame])

  // The overlay for the chosen frame and lens.
  useEffect(() => {
    const img = new window.Image()
    img.src = `/tryon/${frame}-${lens}.webp`
    img.onload = () => (overlay.current = img)
  }, [frame, lens])

  // Camera and tracker: started once, stopped (camera light off) when the window closes.
  useEffect(() => {
    let stream: MediaStream | undefined
    let landmarker: FaceLandmarker | undefined
    let raf = 0
    let stopped = false
    const smooth = { x: 0, y: 0, w: 0, a: 0, ready: false }
    let seen = false

    const draw = () => {
      const v = video.current
      const c = canvas.current
      if (stopped || !v || !c || !landmarker) return
      if (v.readyState >= 2) {
        const W = (c.width = v.videoWidth)
        const H = (c.height = v.videoHeight)
        const ctx = c.getContext('2d')!
        ctx.save()
        // A mirror, like the front camera of a phone: the image and the drawn frame are flipped together.
        ctx.translate(W, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(v, 0, 0, W, H)
        const pts = landmarker.detectForVideo(v, performance.now()).faceLandmarks[0]
        if (pts) {
          const p = (i: number) => ({ x: pts[i].x * W, y: pts[i].y * H })
          const r = p(EYE_R)
          const l = p(EYE_L)
          const b = p(BRIDGE)
          const faceW = Math.hypot(p(TEMPLE_L).x - p(TEMPLE_R).x, p(TEMPLE_L).y - p(TEMPLE_R).y)
          const target = { x: (r.x + l.x) / 2, y: ((r.y + l.y) / 2) * 0.82 + b.y * 0.18, w: faceW * (FIT[frameRef.current] ?? 1), a: Math.atan2(l.y - r.y, l.x - r.x) }
          const k = smooth.ready ? 0.45 : 1
          smooth.x += (target.x - smooth.x) * k
          smooth.y += (target.y - smooth.y) * k
          smooth.w += (target.w - smooth.w) * k
          smooth.a += (target.a - smooth.a) * k
          smooth.ready = true
          const img = overlay.current
          if (img) {
            const h = (smooth.w * img.naturalHeight) / img.naturalWidth
            ctx.translate(smooth.x, smooth.y)
            ctx.rotate(smooth.a)
            ctx.drawImage(img, -smooth.w / 2, -h * 0.5, smooth.w, h)
          }
        }
        if (!!pts !== seen) setFace((seen = !!pts))
        ctx.restore()
      }
      raf = requestAnimationFrame(draw)
    }

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false })
      } catch (e) {
        if (!stopped) setStatus((e as Error).name === 'NotAllowedError' ? 'denied' : 'error')
        return
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop())
      const v = video.current!
      v.srcObject = stream
      await v.play().catch(() => {})
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const files = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
        const make = (delegate: 'GPU' | 'CPU') => FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate }, runningMode: 'VIDEO', numFaces: 1 })
        landmarker = await make('GPU').catch(() => make('CPU'))
      } catch {
        if (!stopped) setStatus('error')
        return
      }
      if (stopped) return
      setStatus('live')
      raf = requestAnimationFrame(draw)
    })()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      landmarker?.close()
    }
  }, [])

  // Escape closes; focus moves into the window and the page behind does not scroll.
  const close = useCallback(() => onClose(), [onClose])
  useEffect(() => {
    dialog.current?.focus()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', key)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = overflow
    }
  }, [close])

  // What the button would add now: this frame with this lens. A frame in the cart as a pachet has both lenses.
  const current = lens === 'rosu' ? `${frame}-rosu` : frame
  const otherLens = lens === 'rosu' ? frame : `${frame}-rosu`
  const inCart = added.some((a) => a.id === current || a.id === `${frame}-pachet`)
  const pairsUp = added.some((a) => a.id === otherLens)
  const name = `${MODELS.find((m) => m.id === model)!.label} ${COLOURS[colour].label.toLowerCase()}`

  const add = () => {
    if (pairsUp) {
      // The other lens of this frame is already in the cart as a single pair: both become the pachet (20% off).
      const key = lineKey({ productId: AMBER, variantId: otherLens })
      const line = cartStore.getSnapshot().find((l) => lineKey(l) === key)
      if (line) {
        if (line.quantity > 1) cartStore.setQuantity(key, line.quantity - 1)
        else cartStore.remove(key)
      }
      if (!addMany([{ productId: AMBER, variantId: `${frame}-pachet`, quantity: 1 }])) return
      setAdded((list) => [...list.filter((a) => a.id !== otherLens), { id: `${frame}-pachet`, label: `${name}, pachet galbene + roșii` }])
      return
    }
    if (!addMany([{ productId: AMBER, variantId: current, quantity: 1 }])) return
    setAdded((list) => [...list, { id: current, label: `${name}, lentile ${LENS_LABEL[lens]}` }])
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={(e) => e.target === e.currentTarget && close()}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="proba-titlu" tabIndex={-1} className="flex max-h-[100svh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] bg-paper outline-none sm:rounded-[28px]">
        <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
          <h2 id="proba-titlu" className="text-[19px] font-medium tracking-[-0.02em] text-ink">
            Probează NEUROS Amber
          </h2>
          <button type="button" onClick={close} aria-label="Închide" className="flex h-10 w-10 items-center justify-center rounded-full bg-mist text-ink hover:bg-mist-2">
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink">
          <video ref={video} playsInline muted className="hidden" />
          <canvas ref={canvas} className="h-full w-full object-cover" aria-label="Imaginea ta de pe cameră, cu ochelarii aleși" />
          {status !== 'live' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-white">
              {status === 'loading' && (
                <>
                  <span aria-hidden className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <p className="text-[15px] text-white/85">Pornim camera. Dacă browserul te întreabă, apasă „Permite”.</p>
                </>
              )}
              {status === 'denied' && <p className="text-[15px] text-white/90">Ca să probezi ochelarii, ai nevoie de acces la cameră. Îl poți permite din setările browserului, apoi deschide din nou proba.</p>}
              {status === 'error' && <p className="text-[15px] text-white/90">Pe acest dispozitiv proba nu a pornit. Încearcă din Chrome sau Safari, pe telefon sau pe laptop.</p>}
            </div>
          )}
          {status === 'live' && !face && <p className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-ink/60 px-3 py-1.5 text-[13px] text-white">Privește spre cameră</p>}
        </div>

        <div className="space-y-4 overflow-y-auto px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))]">
          {/* 1. The model, as the glasses themselves. */}
          <div role="radiogroup" aria-label="Model" className="grid grid-cols-3 gap-2">
            {MODELS.map((m) => {
              const on = model === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setModel(m.id)
                    if (!m.colours.includes(colour)) setColour(m.colours[0])
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-[16px] px-2 pt-3 pb-2.5 transition ${on ? 'bg-white shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'bg-mist hover:bg-mist-2'}`}
                >
                  <Image src={m.icon} alt="" sizes="140px" className="h-9 w-auto object-contain" />
                  <span className={`text-[13px] leading-tight ${on ? 'font-semibold text-ink' : 'font-medium text-text'}`}>{m.label}</span>
                </button>
              )
            })}
          </div>

          {/* 2. The frame colours this model is made in. */}
          <div className="flex items-center gap-3">
            <span className="text-[14px] text-text">
              Ramă: <strong className="font-semibold text-ink">{COLOURS[colour].label}</strong>
            </span>
            <div role="radiogroup" aria-label="Culoarea ramei" className="flex gap-2.5">
              {MODELS.find((m) => m.id === model)!.colours.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={colour === c}
                  aria-label={COLOURS[c].label}
                  onClick={() => setColour(c)}
                  className={`h-8 w-8 rounded-full transition ${colour === c ? 'shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--color-ink)]' : 'shadow-[inset_0_0_0_1px_rgba(0,0,0,.15)] hover:scale-110'}`}
                  style={{ background: COLOURS[c].swatch }}
                />
              ))}
            </div>
          </div>

          {/* 3. The lens. */}
          <div className="grid grid-cols-2 gap-2">
            {(['galben', 'rosu'] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lens === l}
                onClick={() => setLens(l)}
                className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-[14.5px] font-medium transition ${lens === l ? 'bg-ink text-white' : 'bg-mist text-ink hover:bg-mist-2'}`}
              >
                <span aria-hidden className="h-4 w-4 rounded-full" style={{ background: l === 'galben' ? '#F2C21B' : '#E2492B' }} />
                {l === 'galben' ? 'Galbene, seara' : 'Roșii, înainte de somn'}
              </button>
            ))}
          </div>

          {added.length > 0 && !inCart && (
            <p className="flex items-start gap-2 rounded-[14px] bg-[#eaf7ef] px-3.5 py-2.5 text-[13.5px] leading-snug text-[#1d6b3a]">
              <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-none">
                <path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                {added.length === 1 ? `${added[0].label} e deja în coș.` : `În coș: ${added.map((a) => a.label).join('; ')}.`}
                {pairsUp && ' Cu și perechea asta, iei pachetul ramei cu 20% reducere.'}
              </span>
            </p>
          )}

          {inCart ? (
            <p className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#eaf7ef] text-[15.5px] font-semibold text-[#1d6b3a]" role="status">
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
                <path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Perechea asta e în coș
            </p>
          ) : (
            <button type="button" onClick={add} className="cta w-full">
              {added.length === 0 ? 'Adaugă în coș' : pairsUp ? 'Adaugă și perechea asta: pachet −20%' : 'Adaugă și perechea asta'}
            </button>
          )}
          {added.length > 0 && (
            <Link href="/cart" className="btn-secondary w-full !min-h-[48px]" onClick={close}>
              Mergi la coș
            </Link>
          )}
          <p className="text-center text-[12.5px] leading-snug text-muted">Imaginea rămâne pe dispozitivul tău. Nu o salvăm și nu o trimitem nicăieri.</p>
        </div>
      </div>
    </div>
  )
}
