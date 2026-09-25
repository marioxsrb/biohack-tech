/** Text wordmark. The source material has no logo file, only "BIOHACK TECH" set in text. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-[0.35em] text-[16px] font-bold leading-none tracking-[0.04em] ${className}`}>
      <span className="text-white">BIOHACK</span>
      <span className="text-cyan">TECH</span>
    </span>
  )
}
