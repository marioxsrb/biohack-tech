/** Printable admin documents (A4): no site header, footer or navigation. The /admin auth applies (proxy). */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="print-root bg-white text-black">{children}</div>
}
