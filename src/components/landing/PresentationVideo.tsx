'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A vertical presentation video in a phone-like frame. It plays muted while it is on screen and pauses
 * when scrolled away; with reduced motion it waits for a tap. Sound only when the visitor asks for it.
 */
export function PresentationVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  // The file stays off the network until the frame is close. preload=metadata was still pulling the whole film.
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setArmed(true)
    }, { rootMargin: '160px 0px', threshold: 0 })
    io.observe(v)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const v = ref.current
    if (!v || !armed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let userPaused = false
    const onPause = () => {
      if (v.dataset.auto !== '1') userPaused = true
      v.dataset.auto = ''
    }
    const onPlay = () => (userPaused = false)
    v.addEventListener('pause', onPause)
    v.addEventListener('play', onPlay)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !userPaused) v.play().catch(() => {})
        else if (!e.isIntersecting && !v.paused) {
          v.dataset.auto = '1'
          v.pause()
        }
      },
      { threshold: 0.4 },
    )
    io.observe(v)
    return () => {
      io.disconnect()
      v.removeEventListener('pause', onPause)
      v.removeEventListener('play', onPlay)
    }
  }, [armed])

  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (!armed) setArmed(true)
    if (!v.getAttribute('src')) {
      v.src = src
      v.load()
    }
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  const toggleSound = () => {
    const v = ref.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    if (!v.muted && v.paused) v.play().catch(() => {})
  }

  return (
    <div className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-[36px] bg-[var(--lp-ink)] shadow-[0_40px_80px_-40px_rgba(8,17,19,.6)] ring-[6px] ring-white">
      <video
        ref={ref}
        src={armed ? src : undefined}
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={toggle}
        className="block aspect-[9/16] w-full cursor-pointer object-cover"
      />
      {!playing && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Pornește video-ul"
          className="absolute inset-0 m-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/90 text-[var(--lp-ink)] shadow-lg transition hover:scale-105"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="ml-1 h-8 w-8 fill-current">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={toggleSound}
        aria-label={muted ? 'Pornește sunetul' : 'Oprește sunetul'}
        className="absolute right-4 bottom-4 flex items-center gap-2 rounded-full bg-black/55 px-3.5 py-2 text-[13px] font-medium text-white backdrop-blur transition hover:bg-black/70"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          {muted ? <path d="m22 9-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
        </svg>
        {muted ? 'Sunet' : 'Fără sunet'}
      </button>
    </div>
  )
}
