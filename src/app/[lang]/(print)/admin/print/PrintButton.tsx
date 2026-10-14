'use client'

/** Opens the browser's print dialog (A4; "Save as PDF" works the same). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="cta sm">
      Printează
    </button>
  )
}
