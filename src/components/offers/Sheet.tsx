'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Close } from '@/components/ui/icons'
import { useUi } from '@/i18n/LocaleProvider'

/**
 * A modal sheet: full screen on phones (header and footer always in view, content scrolls between them),
 * a centred dialog on larger screens. Escape, the close button and the backdrop close it; focus moves in
 * on open and back to where it was on close; the page behind does not scroll.
 */
export function Sheet({ open, onClose, title, label, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; label: string; children: ReactNode; footer?: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const ui = useUi()

  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !panelRef.current) return
      // Keep Tab inside the sheet.
      const f = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])')]
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault()
        f[f.length - 1].focus()
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault()
        f[0].focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = overflow
      before?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end justify-center sm:items-center sm:p-6">
      <div aria-hidden className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative flex h-[100dvh] w-full flex-col bg-mist sm:h-auto sm:max-h-[min(92dvh,900px)] sm:max-w-[820px] sm:overflow-hidden sm:rounded-[24px] sm:shadow-[0_40px_80px_-30px_rgba(8,17,19,.5)]"
      >
        <div className="flex flex-none items-center justify-between gap-4 border-b border-line bg-paper px-5 py-3 sm:px-7 sm:py-4">
          <div className="min-w-0">{title}</div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={ui.close} className="-mr-2 flex h-11 w-11 flex-none items-center justify-center rounded-full text-ink hover:bg-mist">
            <Close className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">{children}</div>
        {footer && <div className="flex-none border-t border-line bg-paper px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-7 sm:py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
