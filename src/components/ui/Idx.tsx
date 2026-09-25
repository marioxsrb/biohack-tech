/** Section index in the sibling site's style: "01 ── LABEL". */
export function Idx({ n, children, className = '' }: { n?: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={`idx ${className}`} data-n={n ?? ''}>
      {n && <i aria-hidden />}
      {children}
    </p>
  )
}
