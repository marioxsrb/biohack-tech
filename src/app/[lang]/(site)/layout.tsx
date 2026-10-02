import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import { Preloader } from '@/components/site/Preloader'

/** The main store: the opening curtain, navigation, content, footer. Advertising landings use (landing)/layout instead. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Preloader />
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  )
}
