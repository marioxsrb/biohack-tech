import { Plus } from './icons'

/** Accordion on native <details>: keyboard and screen-reader support with no script. */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="border-t border-line">
      {items.map((f) => (
        <details key={f.q} className="faq group border-b border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium tracking-[-0.012em] text-ink [&::-webkit-details-marker]:hidden">
            {f.q}
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full shadow-[inset_0_0_0_1px_var(--color-line)] transition-[transform,background-color] duration-300 group-open:rotate-45 group-open:bg-ink group-open:text-white group-open:shadow-none">
              <Plus className="h-4 w-4" />
            </span>
          </summary>
          <div className="faq-body">
            <p className="max-w-[40em] pb-6 text-muted">{f.a}</p>
          </div>
        </details>
      ))}
    </div>
  )
}
