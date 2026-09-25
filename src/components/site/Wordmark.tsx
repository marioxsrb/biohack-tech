/** Text wordmark. The source material has no logo file, only "BIOHACK TECH" set in text. */
export function Wordmark({ tone = 'dark', className = '' }: { tone?: 'dark' | 'light'; className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-[0.35em] text-[16px] font-bold leading-none tracking-[0.04em] ${className}`}>
      <span>BIOHACK</span>
      {/* A real space, so the accessible name reads "BIOHACK TECH". */}
      <span className="sr-only"> </span>
      <span className={tone === 'dark' ? 'text-cyan' : 'text-cyan-700'}>TECH</span>
    </span>
  )
}
