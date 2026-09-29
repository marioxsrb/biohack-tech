import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'

/** The main store: navigation, content, footer. Advertising landings use (landing)/layout instead. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  )
}
