import type { Landing } from '@/content/landings'
import { AmberLanding } from './pages/AmberLanding'
import { CalmLanding } from './pages/CalmLanding'
import { FocusLanding } from './pages/FocusLanding'

/** Each product tells its own story (pages/*); they share the frame, typography and purchase parts (kit). */
export function LandingPage({ landing, gated = false }: { landing: Landing; gated?: boolean }) {
  switch (landing.slug) {
    case 'calm':
      return <CalmLanding landing={landing} gated={gated} />
    case 'focus':
      return <FocusLanding landing={landing} gated={gated} />
    case 'amber':
      return <AmberLanding landing={landing} gated={gated} />
  }
}
