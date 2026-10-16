'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const WELCOME_START = 'bt-welcome-start'
const CHAT_START = 'bt-chat-start'

/**
 * The chat and the welcome offer are not part of the first screen. Their modules (the AI SDK in particular)
 * load after the page's own load event, on idle, so they do not compete with the hero photograph.
 * The visit clocks are written here, at once, so a late mount still shows the offer at one minute and the
 * greeting at 30 seconds. On acces the welcome clock stays inside WelcomePopup: it starts at unlock, not at arrival.
 */
const Assistant = dynamic(() => import('@/components/assistant/Assistant').then((m) => m.Assistant), { ssr: false })
const WelcomePopup = dynamic(() => import('@/components/site/WelcomePopup').then((m) => m.WelcomePopup), { ssr: false })

export function DeferredChrome() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      if (!/^acces\./.test(location.hostname) && !sessionStorage.getItem(WELCOME_START)) {
        sessionStorage.setItem(WELCOME_START, String(Date.now()))
      }
      if (!sessionStorage.getItem(CHAT_START)) sessionStorage.setItem(CHAT_START, String(Date.now()))
    } catch {
      // Private mode: the widgets keep their own clocks when they mount.
    }

    let idle = 0
    let timer = 0
    const start = () => setReady(true)
    const arm = () => {
      const ric = window.requestIdleCallback
      if (typeof ric === 'function') idle = ric(start, { timeout: 2000 })
      else timer = window.setTimeout(start, 1)
    }
    if (document.readyState === 'complete') arm()
    else window.addEventListener('load', arm, { once: true })
    return () => {
      window.removeEventListener('load', arm)
      if (idle) window.cancelIdleCallback(idle)
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  if (!ready) return null
  return (
    <>
      <WelcomePopup />
      <Assistant />
    </>
  )
}
