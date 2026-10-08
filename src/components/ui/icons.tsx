import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export const Arrow = (p: P) => (
  <svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)
export const Bag = (p: P) => (
  <svg {...base} {...p}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
)
export const Close = (p: P) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const Plus = (p: P) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const Minus = (p: P) => (
  <svg {...base} {...p}><path d="M5 12h14" /></svg>
)
export const Menu = (p: P) => (
  <svg {...base} {...p}><path d="M4 8h16M4 16h16" /></svg>
)
export const Chevron = (p: P) => (
  <svg {...base} {...p}><path d="m6 9 6 6 6-6" /></svg>
)
export const Check = (p: P) => (
  <svg {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
)
export const Mail = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></svg>
)
export const Phone = (p: P) => (
  <svg {...base} {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>
)
export const External = (p: P) => (
  <svg {...base} {...p}><path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" /></svg>
)
export const Lock = (p: P) => (
  <svg {...base} {...p}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
)
export const CardIcon = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></svg>
)
export const Bank = (p: P) => (
  <svg {...base} {...p}><path d="M3 9.5 12 4l9 5.5M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3 20h18" /></svg>
)
export const Copy = (p: P) => (
  <svg {...base} {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></svg>
)
export const Truck = (p: P) => (
  <svg {...base} {...p}><path d="M3 6.5h11v10H3zM14 9.5h3.8l3.2 3.4v3.6h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></svg>
)
export const Return = (p: P) => (
  <svg {...base} {...p}><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6" /><path d="M4 4v4.6h4.6" /></svg>
)
export const ShieldCheck = (p: P) => (
  <svg {...base} {...p}><path d="M12 3.5 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6l-7-2.5Z" /><path d="m9 12 2.2 2.2L15.2 10" /></svg>
)
export const Users = (p: P) => (
  <svg {...base} {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.4a5.5 5.5 0 0 1 3 5.1" /></svg>
)
/** WhatsApp's speech bubble with a handset, drawn in the same line style as the other icons. */
export const WhatsApp = (p: P) => (
  <svg {...base} {...p}><path d="M4 20l1.2-3.9A8.3 8.3 0 1 1 8.4 19z" /><path d="M9.2 8.2c.3-.4.9-.4 1.1 0l.7 1.4c.1.3 0 .6-.2.8l-.5.5a5.6 5.6 0 0 0 2.8 2.8l.5-.5c.2-.2.5-.3.8-.2l1.4.7c.4.2.4.8 0 1.1-.7.6-1.6.9-2.5.6a7.6 7.6 0 0 1-4.7-4.7c-.3-.9 0-1.8.6-2.5Z" /></svg>
)
export const Wallet = (p: P) => (
  <svg {...base} {...p}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v2.5" /><path d="M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9.5a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5Z" /><circle cx="16" cy="13" r="1.2" /></svg>
)
