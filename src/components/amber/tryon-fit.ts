/**
 * Where each frame's try-on layers (public/tryon/<frame>-rama.webp and -lentila.png, 900 px wide, made from the
 * studio front shot) have their anchors, in image pixels: the centre of each lens, the hinges (outer edge at hinge
 * height) and the bridge. The try-on maps them onto the eyes, the temples and the bridge of the nose.
 * Generated with the layers; regenerate both together.
 */
export type Pt = [number, number]
export type FrameFit = { w: number; h: number; lensL: Pt; lensR: Pt; hingeL: Pt; hingeR: Pt; bridge: Pt }

export const TRYON_FIT: Record<string, FrameFit> = {
  'cat-eye-negru': { w: 900, h: 368, lensL: [247.5, 199.0], lensR: [652.0, 198.5], hingeL: [68.0, 141], hingeR: [829.0, 141], bridge: [450.5, 134.0] },
  'cat-eye-bej': { w: 900, h: 354, lensL: [245.5, 190.0], lensR: [653.5, 190.0], hingeL: [63.0, 135], hingeR: [835.0, 135], bridge: [449.5, 129.0] },
  'patrat-negru': { w: 900, h: 366, lensL: [249.0, 183.0], lensR: [650.0, 183.0], hingeL: [74.0, 124], hingeR: [825.0, 124], bridge: [449.5, 116.9] },
  'patrat-maro': { w: 900, h: 389, lensL: [255.0, 214.0], lensR: [646.0, 214.0], hingeL: [78.0, 157], hingeR: [825.0, 157], bridge: [452.0, 150.2] },
  'subtire-negru': { w: 900, h: 321, lensL: [218.5, 160.0], lensR: [681.5, 160.0], hingeL: [15.0, 90], hingeR: [885.0, 90], bridge: [450.0, 82.2] },
}
