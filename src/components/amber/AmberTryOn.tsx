'use client'

/**
 * NEUROS Amber, live try-on: the front camera with the chosen frame drawn over the eyes, like a filter. The face is
 * tracked in the browser (MediaPipe Face Landmarker, its WebAssembly and model served from /public/mediapipe); no
 * frame of the video leaves the device and nothing is stored. The layers (public/tryon/<frame>-rama.webp and
 * -lentila.png) come from the studio front shots. Loaded only when the visitor opens it.
 */
import Image, { type StaticImageData } from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'

import { useCart } from '@/components/cart/CartProvider'
import Link from '@/components/ui/Link'
import type { ProductId } from '@/content/catalog'
import { TRYON_FIT } from './tryon-fit'
import { placement, renderGlasses, type FrameStyle, type Landmarks } from './tryon-render'
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
/**
 * Per frame: the colour and width of the temples (cat eye has thin gold metal arms, the square frames acetate, the
 * thin frame wire) and how far beyond the temples the hinges sit.
 */
const STYLE: Record<string, FrameStyle> = {
  'cat-eye-negru': { temple: '#b99a5e', templeWidth: 0.012, fit: 1.06 },
  'cat-eye-bej': { temple: '#c4a46c', templeWidth: 0.012, fit: 1.06 },
  'patrat-negru': { temple: '#15181a', templeWidth: 0.026, fit: 1.04 },
  'patrat-maro': { temple: 'rgba(86,56,38,0.95)', templeWidth: 0.026, fit: 1.04 },
  'subtire-negru': { temple: '#1b1b1b', templeWidth: 0.009, fit: 1.02 },
}
/** The yellow lens as a filter: what it lets through (multiplied with the face behind it). */
const TINT: [number, number, number] = [255, 206, 0]

type Status = 'loading' | 'live' | 'denied' | 'error'


/**
 * Pairs added from the try-on stay listed while the window is open: the visitor keeps trying, and the button offers
 * to add the next frame too.
 */
type Added = { id: string; label: string }

export function AmberTryOn({ frame: initialFrame, onClose }: { frame: string; onClose: () => void }) {
  const start = MODELS.find((m) => initialFrame.startsWith(`${m.id}-`)) ?? MODELS[0]
  const [model, setModel] = useState(start.id)
  const [colour, setColour] = useState(start.colours.find((c) => initialFrame === `${start.id}-${c}`) ?? start.colours[0])
  const frame = `${model}-${colour}`
  const [added, setAdded] = useState<Added[]>([])
  // A photo taken from the try-on: shown over the camera until the visitor goes back; shared only on request.
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [share, setShare] = useState<{ state: 'idle' | 'busy' | 'done' | 'error'; link?: string; copied?: boolean }>({ state: 'idle' })
  const { addMany } = useCart()
  const [status, setStatus] = useState<Status>('loading')
  const [face, setFace] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const layers = useRef<{ frame: HTMLImageElement; lens: HTMLImageElement; id: string } | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  // Read by the drawing loop, so changing the frame does not restart the camera.
  const frameRef = useRef(frame)
  useEffect(() => {
    frameRef.current = frame
  }, [frame])

  // The frame's two layers (the front, and the lens shape that gets tinted).
  useEffect(() => {
    const frameImg = new window.Image()
    const lensImg = new window.Image()
    let ready = 0
    const done = () => ++ready === 2 && (layers.current = { frame: frameImg, lens: lensImg, id: frame })
    frameImg.onload = done
    lensImg.onload = done
    frameImg.src = `/tryon/${frame}-rama.webp`
    lensImg.src = `/tryon/${frame}-lentila.png`
  }, [frame])

  // Camera and tracker: started once, stopped (camera light off) when the window closes.
  useEffect(() => {
    let stream: MediaStream | undefined
    let landmarker: FaceLandmarker | undefined
    let raf = 0
    let stopped = false
    const scratch = document.createElement('canvas')
    // The mesh, eased between video frames so the glasses sit still on a still face.
    let prev: Landmarks | null = null
    const smoothed = (raw: Landmarks): Landmarks => {
      const out = raw.map((p, i) => (prev?.[i] ? { x: prev[i].x + (p.x - prev[i].x) * 0.5, y: prev[i].y + (p.y - prev[i].y) * 0.5, z: prev[i].z + (p.z - prev[i].z) * 0.5 } : { x: p.x, y: p.y, z: p.z }))
      prev = out
      return out
    }
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
        const raw = landmarker.detectForVideo(v, performance.now()).faceLandmarks[0]
        const pts = raw && smoothed(raw)
        const l = layers.current
        const fit = l && TRYON_FIT[l.id]
        if (pts && l && fit) {
          const style = STYLE[l.id]
          const base = ctx.getTransform()
          renderGlasses(ctx, scratch, base, placement(pts, W, H, style, fit), { frame: l.frame, lens: l.lens, fit }, TINT, style)
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

  // What the button would add now: one pair of this frame.
  const current = frame
  const inCart = added.some((a) => a.id === current)
  const name = `${MODELS.find((m) => m.id === model)!.label} ${COLOURS[colour].label.toLowerCase()}`

  const add = () => {
    if (!addMany([{ productId: AMBER, variantId: current, quantity: 1 }])) return
    setAdded((list) => [...list, { id: current, label: name }])
  }

  const snap = () => {
    const c = canvas.current
    if (!c || !c.width) return
    // The picture as it is on screen, with a small mark in the corner.
    const out = document.createElement('canvas')
    out.width = c.width
    out.height = c.height
    const o = out.getContext('2d')!
    o.drawImage(c, 0, 0)
    const size = Math.round(c.width * 0.026)
    o.font = `600 ${size}px system-ui, sans-serif`
    o.textAlign = 'right'
    o.fillStyle = 'rgba(255,255,255,0.92)'
    o.shadowColor = 'rgba(0,0,0,0.45)'
    o.shadowBlur = size / 2
    o.fillText('NEUROS Amber · biohack-tech.ro', c.width - size, c.height - size)
    out.toBlob((blob) => blob && setPhoto({ blob, url: URL.createObjectURL(blob) }), 'image/jpeg', 0.88)
    setShare({ state: 'idle' })
  }

  const closePhoto = () => {
    if (photo) URL.revokeObjectURL(photo.url)
    setPhoto(null)
    setShare({ state: 'idle' })
  }

  const shareLink = async () => {
    if (!photo) return
    let link = share.link
    if (!link) {
      setShare({ state: 'busy' })
      const res = await fetch('/api/proba', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: photo.blob }).catch(() => null)
      const json = (await res?.json().catch(() => null)) as { ok?: boolean; url?: string } | null
      if (!json?.ok || !json.url) return setShare({ state: 'error' })
      link = json.url
    }
    setShare({ state: 'done', link })
    const text = 'Cum îmi stau ochelarii NEUROS Amber?'
    if (navigator.share) {
      await navigator.share({ title: text, text, url: link }).catch(() => {})
      return
    }
    const copied = await navigator.clipboard?.writeText(link).then(() => true, () => false)
    setShare({ state: 'done', link, copied })
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
          {status === 'live' && !face && !photo && <p className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-ink/60 px-3 py-1.5 text-[13px] text-white">Privește spre cameră</p>}
          {status === 'live' && !photo && (
            <button type="button" onClick={snap} aria-label="Fă o poză" className="absolute bottom-4 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-white/25 backdrop-blur transition hover:bg-white/35">
              <span className="h-12 w-12 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,.3)]" />
            </button>
          )}
          {photo && (
            <div className="absolute inset-0 bg-ink">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local photo (object URL), not an asset */}
              <img src={photo.url} alt="Poza ta cu NEUROS Amber" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-2 bg-[linear-gradient(0deg,rgba(11,19,22,.8),rgba(11,19,22,0))] p-4 pt-10">
                <button type="button" onClick={shareLink} disabled={share.state === 'busy'} className="cta sm !min-h-11">
                  {share.state === 'busy' ? 'Se pregătește linkul…' : 'Distribuie link'}
                </button>
                <a href={photo.url} download="neuros-amber.jpg" className="btn-secondary sm !min-h-11 !bg-white">
                  Salvează
                </a>
                <button type="button" onClick={closePhoto} className="btn-secondary sm !min-h-11 !bg-white">
                  Altă poză
                </button>
              </div>
            </div>
          )}
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

          {added.length > 0 && !inCart && (
            <p className="flex items-start gap-2 rounded-[14px] bg-[#eaf7ef] px-3.5 py-2.5 text-[13.5px] leading-snug text-[#1d6b3a]">
              <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-none">
                <path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                {added.length === 1 ? `${added[0].label} e deja în coș.` : `În coș: ${added.map((a) => a.label).join('; ')}.`}
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
              {added.length === 0 ? 'Adaugă în coș' : 'Adaugă și perechea asta'}
            </button>
          )}
          {added.length > 0 && (
            <Link href="/cart" className="btn-secondary w-full !min-h-[48px]" onClick={close}>
              Mergi la coș
            </Link>
          )}
          {share.state === 'done' && share.link && (
            <p className="rounded-[14px] bg-mist px-3.5 py-2.5 text-[13.5px] leading-snug text-text">
              {share.copied ? 'Linkul e copiat: ' : 'Linkul pozei: '}
              <a href={share.link} target="_blank" rel="noopener noreferrer" className="font-semibold break-all text-ink underline">
                {share.link}
              </a>
            </p>
          )}
          {share.state === 'error' && <p className="text-[13.5px] text-[#d93636]">Linkul nu s-a putut face acum. Încearcă din nou peste puțin timp sau salvează poza.</p>}
          <p className="text-center text-[12.5px] leading-snug text-muted">Imaginea rămâne pe dispozitivul tău. O poză ajunge pe site doar dacă apeși „Distribuie link”, și o ștergem după 30 de zile.</p>
        </div>
      </div>
    </div>
  )
}
