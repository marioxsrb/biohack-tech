/**
 * Draws a NEUROS Amber frame on a face, as close to the real glasses as a flat canvas allows (checked against
 * videos of the real frames worn, 20.10.2026):
 *  - the frame front is a plane held in front of the eyes and turned with the head (from the face mesh in 3D),
 *    so it turns, tilts and foreshortens like the real one, with the lenses in front of the eyes;
 *  - the lens is tinted glass: its colour multiplies what is behind it (the eyes stay visible), with a soft
 *    reflection across it;
 *  - when the head turns, the temple on the side facing the camera runs back towards the ear.
 * Coordinates are the video's pixels; the caller has already mirrored the context.
 */
import type { FrameFit, Pt } from './tryon-fit'

export type Landmarks = { x: number; y: number; z: number }[]
export type FrameStyle = { temple: string; templeWidth: number; fit: number }

// Face mesh points (MediaPipe Face Landmarker, 478 points with the irises).
const IRIS_R = 468
const IRIS_L = 473
const EYE_R = 33
const EYE_L = 263
const TEMPLE_R = 127
const TEMPLE_L = 356
const BRIDGE_TOP = 168
const BRIDGE_LOW = 6
const NOSE_TIP = 1
const FOREHEAD = 10
const CHIN = 152

type V3 = [number, number, number]
type Matrix = [number, number, number, number, number, number]
const apply = (m: Matrix, q: Pt): Pt => [m[0] * q[0] + m[2] * q[1] + m[4], m[1] * q[0] + m[3] * q[1] + m[5]]
/** How much each half of the front turns back from the bridge (radians): the frame's curve around the face. */
const WRAP = 0.17
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: V3): V3 => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1))

/**
 * Where the frame lands on this face. The frame front is a flat plane a little in front of the eyes, turned with
 * the head: its image is mapped onto that plane (across = from the wearer's right temple to the left one, down =
 * the head's down), seen by the camera. So it foreshortens when the head turns or nods, and tilts with it.
 */
export function placement(pts: Landmarks, W: number, H: number, style: FrameStyle, fit: FrameFit) {
  const P = (i: number): V3 => [pts[i].x * W, pts[i].y * H, pts[i].z * W]
  const across = norm(sub(P(TEMPLE_L), P(TEMPLE_R)))
  let up = sub(P(FOREHEAD), P(CHIN))
  up = norm(sub(up, mul(across, dot(up, across))))
  const down = mul(up, -1)
  const nose = sub(P(NOSE_TIP), mul(add(P(TEMPLE_R), P(TEMPLE_L)), 0.5))
  const forward = norm(sub(sub(nose, mul(across, dot(nose, across))), mul(up, dot(nose, up))))
  const back = mul(forward, -1)

  // The face's width at the temples, measured along the head (the same whichever way it turns).
  const templeW = dot(sub(P(TEMPLE_L), P(TEMPLE_R)), across)
  const frameW = templeW * style.fit
  const ahead = mul(forward, templeW * 0.07)
  const bridge = add(mul(add(P(BRIDGE_TOP), P(BRIDGE_LOW)), 0.5), ahead)
  const iris = (i: number, a: number, b: number): V3 => add(pts[i] ? P(i) : mul(add(P(a), P(b)), 0.5), ahead)

  // Image pixels → face: one scale for the whole front (frame width in image px ↔ frame width on the face).
  const s = frameW / (fit.hingeR[0] - fit.hingeL[0])
  const X = mul(across, s)
  const Y = mul(down, s)
  const at = (q: Pt, origin: V3): V3 => add(origin, add(mul(X, q[0] - fit.bridge[0]), mul(Y, q[1] - fit.bridge[1])))
  // Shift along "down" (in the frame plane) so the lens centres sit in front of the eyes, on average.
  const offR = dot(sub(iris(IRIS_R, EYE_R, 133), at(fit.lensL, bridge)), down)
  const offL = dot(sub(iris(IRIS_L, EYE_L, 362), at(fit.lensR, bridge)), down)
  const origin = add(bridge, mul(down, (offR + offL) / 2))
  const o = at([0, 0], origin)
  // The top of the ear: behind the face's side at eye level.
  const ear = (t: V3) => add(add(t, mul(back, templeW * 0.3)), mul(down, templeW * 0.04))
  // A temple shows when its side of the head faces the camera (that side is nearer than the other one).
  const turn = (P(TEMPLE_L)[2] - P(TEMPLE_R)[2]) / templeW
  // Real fronts curve a little around the face: each half turns back by WRAP from the bridge.
  const half = (sign: 1 | -1): Matrix => {
    const dir = add(mul(across, Math.cos(WRAP)), mul(back, Math.sin(WRAP) * sign))
    const Xh = mul(dir, s)
    // Anchored at the bridge so both halves meet there.
    const b = at(fit.bridge, origin)
    return [Xh[0], Xh[1], Y[0], Y[1], b[0] - Xh[0] * fit.bridge[0] - Y[0] * fit.bridge[1], b[1] - Xh[1] * fit.bridge[0] - Y[1] * fit.bridge[1]]
  }
  return {
    matrix: [X[0], X[1], Y[0], Y[1], o[0], o[1]] as Matrix,
    halves: [half(-1), half(1)] as [Matrix, Matrix],
    // The hinges where the curved front ends (the temples start there).
    hingeR: apply(half(-1), fit.hingeL),
    hingeL: apply(half(1), fit.hingeR),
    earR: ear(P(TEMPLE_R)).slice(0, 2) as Pt,
    earL: ear(P(TEMPLE_L)).slice(0, 2) as Pt,
    showR: Math.min(1, Math.max(0, (turn - 0.1) / 0.2)),
    showL: Math.min(1, Math.max(0, (-turn - 0.1) / 0.2)),
    faceW: frameW,
  }
}

export type Placement = ReturnType<typeof placement>

/** Draws `img` (laid out like the frame's fit) onto the frame front, half by half (split at the bridge). */
function drawFront(ctx: CanvasRenderingContext2D, img: CanvasImageSource, fit: FrameFit, p: Placement) {
  const parts: [Matrix, number, number][] = [
    [p.halves[0], 0, fit.bridge[0] + 0.5],
    [p.halves[1], fit.bridge[0] - 0.5, fit.w],
  ]
  for (const [m, x0, x1] of parts) {
    ctx.save()
    ctx.transform(...m)
    ctx.beginPath()
    ctx.rect(x0, 0, x1 - x0, fit.h)
    ctx.clip()
    ctx.drawImage(img, 0, 0, fit.w, fit.h)
    ctx.restore()
  }
}

function drawTemple(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, show: number, style: FrameStyle, faceW: number) {
  if (show <= 0) return
  const w0 = faceW * style.templeWidth
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  ctx.save()
  ctx.globalAlpha = show
  ctx.fillStyle = style.temple
  // A tapered arm: full width at the hinge, a little thinner at the ear.
  ctx.beginPath()
  ctx.moveTo(from[0] + (nx * w0) / 2, from[1] + (ny * w0) / 2)
  ctx.lineTo(to[0] + (nx * w0) / 3, to[1] + (ny * w0) / 3)
  ctx.lineTo(to[0] - (nx * w0) / 3, to[1] - (ny * w0) / 3)
  ctx.lineTo(from[0] - (nx * w0) / 2, from[1] - (ny * w0) / 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * One frame of the try-on, drawn over the (already drawn, mirrored) video in `ctx`. `scratch` is a canvas of the
 * same size, used to build the lens tint; `base` is the mirroring transform both share.
 */
export function renderGlasses(
  ctx: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  base: DOMMatrix,
  p: Placement,
  layers: { frame: HTMLImageElement; lens: HTMLImageElement; fit: FrameFit },
  tint: [number, number, number],
  style: FrameStyle,
) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  if (scratch.width !== W || scratch.height !== H) {
    scratch.width = W
    scratch.height = H
  }
  const s = scratch.getContext('2d')!

  // Temples first: they sit behind the frame front.
  ctx.save()
  ctx.setTransform(base)
  drawTemple(ctx, p.hingeR, p.earR, p.showR, style, p.faceW)
  drawTemple(ctx, p.hingeL, p.earL, p.showL, style, p.faceW)
  ctx.restore()

  // The lens as tinted glass: its colour multiplies the face behind it.
  s.setTransform(1, 0, 0, 1, 0, 0)
  s.globalCompositeOperation = 'source-over'
  s.clearRect(0, 0, W, H)
  s.setTransform(base)
  drawFront(s, layers.lens, layers.fit, p)
  s.setTransform(1, 0, 0, 1, 0, 0)
  s.globalCompositeOperation = 'source-in'
  s.fillStyle = `rgb(${tint.join(',')})`
  s.fillRect(0, 0, W, H)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = 0.92
  ctx.drawImage(scratch, 0, 0)
  ctx.restore()

  // A soft reflection across the lens, like the room lights on the real ones.
  s.globalCompositeOperation = 'source-over'
  s.clearRect(0, 0, W, H)
  s.setTransform(base)
  drawFront(s, layers.lens, layers.fit, p)
  s.setTransform(1, 0, 0, 1, 0, 0)
  s.globalCompositeOperation = 'source-in'
  const g0 = base.transformPoint(new DOMPoint(p.hingeR[0], p.hingeR[1] - p.faceW * 0.25))
  const g1 = base.transformPoint(new DOMPoint(p.hingeL[0], p.hingeL[1] + p.faceW * 0.25))
  const g = s.createLinearGradient(g0.x, g0.y, g1.x, g1.y)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.32, 'rgba(255,255,255,0.22)')
  g.addColorStop(0.4, 'rgba(255,255,255,0)')
  g.addColorStop(0.7, 'rgba(255,255,255,0.12)')
  g.addColorStop(0.76, 'rgba(255,255,255,0)')
  s.fillStyle = g
  s.fillRect(0, 0, W, H)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'screen'
  ctx.drawImage(scratch, 0, 0)
  ctx.restore()

  // The frame front on top.
  ctx.save()
  ctx.setTransform(base)
  drawFront(ctx, layers.frame, layers.fit, p)
  ctx.restore()
}
