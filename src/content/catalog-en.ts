/**
 * English text for the catalog. The Romanian catalog (catalog.ts) stays the source of truth for ids, prices,
 * variants and images; this file only overlays what a visitor reads on /en: names of kinds, purposes,
 * taglines, option labels and image descriptions. Orders, invoices and the CRM keep the Romanian labels.
 */
import type { ProductId } from './catalog'

type ProductText = { kind: string; purpose: string; tagline: string; chooseLabel?: string }

export const productTextEn: Record<ProductId, ProductText> = {
  'balance-wave': {
    kind: 'Vagus nerve stimulation and relaxation',
    purpose: 'For relaxation',
    tagline: 'You wear it around your neck. It gives you a few minutes of red light and quiet. It switches off by itself.',
  },
  'brainlink-pro': {
    kind: 'EEG headband for attention training',
    purpose: 'For focus',
    tagline: 'A light headband with games on a tablet. You control them with your attention. That is how you train your focus.',
  },
  'ochelari-biohack': {
    kind: 'Glasses with a blue light filter',
    purpose: 'For screens',
    tagline: 'They filter the blue light of screens. Your eyes get a warmer light. Choose from four frames.',
    chooseLabel: 'Choose the frame',
  },
}

/** Option names and values, by their Romanian label. */
export const optionLabelEn: Record<string, string> = {
  Model: 'Model',
  Culoare: 'Colour',
  'Cat eye': 'Cat eye',
  'Unisex pătrat': 'Unisex square',
  Negru: 'Black',
  Bej: 'Beige',
  Maro: 'Brown',
}

const ALT: Record<string, string> = {
  'Cele patru rame NEUROS Amber, așezate pe o masă': 'The four NEUROS Amber frames on a table',
  'Cele patru rame NEUROS Amber, printre ele cat eye negru': 'The four NEUROS Amber frames, the black cat eye among them',
  'Cele patru rame NEUROS Amber: cat eye negru și bej, unisex pătrat negru și maro': 'The four NEUROS Amber frames: cat eye in black and beige, unisex square in black and brown',
  'Femeie cu ochii închiși, purtând NEUROS Calm la gât': 'Woman with her eyes closed, wearing NEUROS Calm around her neck',
  'Femeie pe o terasă, purtând NEUROS Amber cat eye bej': 'Woman on a terrace, wearing NEUROS Amber cat eye in beige',
  'Femeie pe o terasă, la apus, purtând NEUROS Amber cat eye bej': 'Woman on a terrace at sunset, wearing NEUROS Amber cat eye in beige',
  'Femeie purtând NEUROS Amber cat eye bej': 'Woman wearing NEUROS Amber cat eye in beige',
  'Femeie relaxată pe canapea, purtând NEUROS Calm': 'Relaxed woman on a sofa, wearing NEUROS Calm',
  'Femeie relaxată pe canapea, purtând NEUROS Calm la gât': 'Relaxed woman on a sofa, wearing NEUROS Calm around her neck',
  'Femeie relaxată pe canapea, cu NEUROS Calm la gât': 'Relaxed woman on a sofa, with NEUROS Calm around her neck',
  'Femeie relaxată, cu ochii închiși, purtând NEUROS Focus': 'Relaxed woman with her eyes closed, wearing NEUROS Focus',
  'Femeie în pat, seara, purtând NEUROS Amber pătrat negru': 'Woman in bed in the evening, wearing NEUROS Amber square in black',
  'Femeie în pat, seara, citind pe tabletă cu ochelarii NEUROS Amber': 'Woman in bed in the evening, reading on a tablet with NEUROS Amber glasses',
  'Femeie în pat, seara, citind pe tabletă cu NEUROS Amber': 'Woman in bed in the evening, reading on a tablet with NEUROS Amber',
  'Femeie în pat, seara, purtând NEUROS Calm': 'Woman in bed in the evening, wearing NEUROS Calm',
  'Femeie meditând în grădină, purtând NEUROS Focus': 'Woman meditating in a garden, wearing NEUROS Focus',
  'NEUROS Amber cat eye, ramă neagră, lentile chihlimbar': 'NEUROS Amber cat eye, black frame, amber lenses',
  'NEUROS Amber pătrat maro pe un birou, lângă tastatură': 'NEUROS Amber square in brown on a desk, next to a keyboard',
  'NEUROS Amber pătrat negru pe noptieră, lângă laptop': 'NEUROS Amber square in black on a bedside table, next to a laptop',
  'NEUROS Calm lângă cutia produsului': 'NEUROS Calm next to its box',
  'NEUROS Calm văzut din spate, cu butonul de pornire': 'NEUROS Calm from the back, with the power button',
  'NEUROS Calm, dispozitivul cu luminile roșii aprinse și cordonul de prindere': 'NEUROS Calm, the device with its red lights on and its neck cord',
  'NEUROS Focus lângă geanta de transport': 'NEUROS Focus next to its carrying case',
  'NEUROS Focus văzută din lateral, cu senzorul de ureche': 'NEUROS Focus from the side, with the ear sensor',
  'NEUROS Focus, casca văzută din unghi': 'NEUROS Focus, the headband at an angle',
  'Tânăr pe canapea, purtând NEUROS Focus și jucând pe tabletă': 'Young man on a sofa, wearing NEUROS Focus and playing on a tablet',
}

const AMBER_FRAME: [RegExp, string][] = [
  [/unisex pătrat/g, 'unisex square'],
  [/\bnegru\b/g, 'in black'],
  [/\bbej\b/g, 'in beige'],
  [/\bmaro\b/g, 'in brown'],
  [/, din față$/, ', front'],
  [/, din lateral$/, ', side'],
  [/, din spate$/, ', back'],
  [/, din unghi$/, ', angled'],
  [/, de sus$/, ', from above'],
]

/** English description of a product image; the per-frame Amber shots follow one pattern. */
export function altEn(ro: string): string {
  if (ALT[ro]) return ALT[ro]
  if (ro.startsWith('NEUROS Amber ')) return AMBER_FRAME.reduce((s, [re, to]) => s.replace(re, to), ro)
  return ro
}
