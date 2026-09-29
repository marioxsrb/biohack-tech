import type { Landing } from '@/content/landings'
import { AmberLanding } from './pages/AmberLanding'
import { CalmLanding } from './pages/CalmLanding'
import { FlowLanding } from './pages/FlowLanding'
import { FocusLanding } from './pages/FocusLanding'

/** Each product tells its own story (pages/*); they share the frame, typography and purchase parts (kit). */
export function LandingPage({ landing }: { landing: Landing }) {
  switch (landing.slug) {
    case 'calm':
      return <CalmLanding landing={landing} />
    case 'focus':
      return <FocusLanding landing={landing} />
    case 'amber':
      return <AmberLanding landing={landing} />
    case 'brain-flow':
      return <FlowLanding landing={landing} />
  }
}
