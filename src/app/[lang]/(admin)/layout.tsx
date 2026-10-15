/** The admin area and its login page: their own screen, without the store's header, footer or offers. */
export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return <main id="main">{children}</main>
}
