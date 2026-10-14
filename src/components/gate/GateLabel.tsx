import type { ReactNode } from 'react'

/**
 * A purchase control's label on the gated host: "Vezi prețul și oferta" while prices are locked, its normal
 * label once unlocked. Both are rendered; CSS on <html data-gate> picks one (globals.css), so the right label
 * shows from the first paint and the main site never sees the locked one.
 */
export function GateLabel({ children, locked = 'Vezi prețul și oferta' }: { children: ReactNode; locked?: ReactNode }) {
  return (
    <>
      <span className="gate-label-locked">{locked}</span>
      <span className="gate-label-open contents">{children}</span>
    </>
  )
}
