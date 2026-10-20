'use client'

/**
 * Before the 10% offer on the NEUROS Calm pages: a minimal animation of a woman (hair up) wearing NEUROS Calm. She
 * turns her back, the visitor taps to press the button at the nape (where it is on the real device), the red light
 * comes on, she turns back and her shoulders drop. Then the gift (the 10% window) opens. Drawn in SVG.
 */
import { useEffect, useState } from 'react'

import { Close } from '@/components/ui/icons'

type Phase = 'front' | 'turn' | 'back' | 'on' | 'return' | 'calm'

const SKIN = '#f0cdb8'
const SKIN_SHADE = '#e2b7a0'
const HAIR = '#3b2a22'
const TOP = '#2b3f45'
const POD = '#fbfbf9'
const POD_EDGE = '#dfe3e2'

function Shoulders({ tense }: { tense: boolean }) {
  return (
    <g style={{ transform: tense ? 'translateY(-16px) scaleX(0.97)' : 'none', transformOrigin: '200px 440px', transition: 'transform 1.6s cubic-bezier(.22,1,.36,1)' }}>
      <path d="M48 460 C52 372 104 336 152 326 L248 326 C296 336 348 372 352 460 Z" fill={TOP} />
      <rect x="172" y="250" width="56" height="92" rx="22" fill={SKIN} />
      <path d="M172 300 C186 312 214 312 228 300 L228 330 L172 330 Z" fill={SKIN_SHADE} opacity=".5" />
    </g>
  )
}

/** The device, from the front: a pod each side of the neck, joined by the band. */
function DeviceFront({ on, tense }: { on: boolean; tense: boolean }) {
  return (
    <g style={{ transform: tense ? 'translateY(-16px)' : 'none', transition: 'transform 1.6s cubic-bezier(.22,1,.36,1)' }}>
      {on && <ellipse cx="200" cy="300" rx="78" ry="26" fill="url(#calm-glow)" className="calm-glow" />}
      <path d="M162 300 C176 312 224 312 238 300" fill="none" stroke={POD_EDGE} strokeWidth="5" strokeLinecap="round" />
      <rect x="140" y="282" width="38" height="34" rx="11" fill={POD} stroke={POD_EDGE} strokeWidth="2" />
      <rect x="222" y="282" width="38" height="34" rx="11" fill={POD} stroke={POD_EDGE} strokeWidth="2" />
      <path d="M200 309 L198 352 M200 309 L203 350" stroke="#3f5a3c" strokeWidth="2" strokeLinecap="round" />
    </g>
  )
}

function FaceFront({ relaxed, tense }: { relaxed: boolean; tense: boolean }) {
  return (
    <g style={{ transform: tense ? 'translateY(-6px)' : 'none', transition: 'transform 1.6s cubic-bezier(.22,1,.36,1)' }}>
      <ellipse cx="136" cy="196" rx="9" ry="14" fill={SKIN_SHADE} />
      <ellipse cx="264" cy="196" rx="9" ry="14" fill={SKIN_SHADE} />
      <ellipse cx="200" cy="190" rx="62" ry="74" fill={SKIN} />
      {/* Hair pulled back into a bun. */}
      <circle cx="200" cy="106" r="27" fill={HAIR} />
      <path d="M138 196 C130 118 270 118 262 196 C256 150 232 132 200 132 C168 132 144 150 138 196 Z" fill={HAIR} />
      {relaxed ? (
        <g stroke="#3b2a22" strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M170 198 Q178 204 186 198" />
          <path d="M214 198 Q222 204 230 198" />
          <path d="M188 230 Q200 238 212 230" />
        </g>
      ) : (
        <g>
          <ellipse cx="178" cy="196" rx="4.5" ry="5.5" fill="#3b2a22" />
          <ellipse cx="222" cy="196" rx="4.5" ry="5.5" fill="#3b2a22" />
          <path d="M170 185 Q178 182 186 185 M214 185 Q222 182 230 185" fill="none" stroke="#3b2a22" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M190 232 L210 232" stroke="#3b2a22" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      <circle cx="166" cy="216" r="8" fill="#f2a1a1" opacity={relaxed ? 0.45 : 0} style={{ transition: 'opacity 1s' }} />
      <circle cx="234" cy="216" r="8" fill="#f2a1a1" opacity={relaxed ? 0.45 : 0} style={{ transition: 'opacity 1s' }} />
    </g>
  )
}

/** From behind: the bun, the nape, and the device's middle pod with its button and lights. */
function Back({ on, hint }: { on: boolean; hint: boolean }) {
  return (
    <g>
      <ellipse cx="136" cy="200" rx="9" ry="14" fill={SKIN_SHADE} />
      <ellipse cx="264" cy="200" rx="9" ry="14" fill={SKIN_SHADE} />
      <ellipse cx="200" cy="190" rx="62" ry="74" fill={HAIR} />
      <circle cx="200" cy="150" r="30" fill="#2e211b" />
      <path d="M176 150 Q200 136 224 150" fill="none" stroke="#4a372d" strokeWidth="3" />
      <g style={{ transform: 'translateY(-16px)' }}>
        {on && <ellipse cx="200" cy="296" rx="90" ry="30" fill="url(#calm-glow)" className="calm-glow" />}
        <rect x="128" y="280" width="40" height="34" rx="11" fill={POD} stroke={POD_EDGE} strokeWidth="2" />
        <rect x="232" y="280" width="40" height="34" rx="11" fill={POD} stroke={POD_EDGE} strokeWidth="2" />
        <rect x="174" y="276" width="52" height="40" rx="12" fill={POD} stroke={POD_EDGE} strokeWidth="2" />
        <circle cx="200" cy="290" r="6" fill="none" stroke="#9aa6a8" strokeWidth="2" />
        {[0, 1, 2, 3].map((k) => (
          <circle key={k} cx={190 + k * 7} cy="305" r="2" fill={on ? '#5fe0cc' : '#c8cfd0'} style={{ transition: `fill .2s ${k * 0.12}s` }} />
        ))}
        {hint && (
          <circle cx="200" cy="290" r="14" fill="none" stroke="#d23b3b" strokeWidth="3" className="calm-tap" />
        )}
      </g>
    </g>
  )
}

export function CalmGate({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('front')

  // Front, then she turns her back on her own; after the tap, the light comes on, she turns back and relaxes.
  useEffect(() => {
    const steps: Partial<Record<Phase, [Phase, number]>> = { front: ['turn', 1400], turn: ['back', 380], on: ['return', 1100], return: ['calm', 380] }
    const next = steps[phase]
    if (!next) return
    const t = setTimeout(() => setPhase(next[0]), next[1])
    return () => clearTimeout(t)
  }, [phase])

  const press = () => phase === 'back' && setPhase('on')
  const facingBack = phase === 'back' || phase === 'on'
  // The turn: the figure narrows to its edge and widens again, like a body turning.
  const squeeze = phase === 'turn' || phase === 'return'
  const on = phase === 'on' || phase === 'return' || phase === 'calm'
  const relaxed = phase === 'calm'

  const title = relaxed ? 'Umerii coboară. Respiri mai ușor.' : facingBack ? 'Apasă butonul de la ceafă.' : 'Pune-ți NEUROS Calm la gât.'
  const lead = relaxed
    ? 'Așa arată câteva minute cu NEUROS Calm, seara. Și pentru că ai ajuns până aici, ai un cadou.'
    : facingBack
      ? on
        ? 'Lumina roșie pornește…'
        : 'Butonul e la spate, ca pe aparatul adevărat. Atinge-l ca să îl pornești.'
      : 'Uite cum se folosește, în câteva secunde.'

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="calm-gate-title" className="relative w-full max-w-[460px] overflow-hidden rounded-[24px] bg-[radial-gradient(110%_80%_at_50%_30%,#f7efe7_0%,#ead9cb_70%)] shadow-[0_40px_100px_-30px_rgba(0,0,0,.6)]">
      <button type="button" onClick={onClose} aria-label="Închide" className="absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-ink backdrop-blur transition-colors hover:bg-white">
        <Close className="h-4 w-4" />
      </button>
      <div className="px-6 pt-6 pr-16">
        <h2 id="calm-gate-title" className="text-[clamp(24px,6vw,30px)] leading-[1.06] font-semibold tracking-[-0.03em] text-ink text-balance">
          {title}
        </h2>
        <p className="mt-2 min-h-[44px] text-[15px] leading-snug text-text">{lead}</p>
      </div>

      <button
        type="button"
        onClick={press}
        disabled={phase !== 'back'}
        aria-label={phase === 'back' ? 'Apasă butonul ca să pornești NEUROS Calm' : 'Animație: NEUROS Calm la gât'}
        className={`block w-full ${phase === 'back' ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <svg viewBox="0 0 400 440" className="mx-auto block w-full max-w-[400px]" role="img" aria-hidden>
          <defs>
            <radialGradient id="calm-glow">
              <stop offset="0%" stopColor="#ff3b3b" stopOpacity=".85" />
              <stop offset="60%" stopColor="#ff3b3b" stopOpacity=".35" />
              <stop offset="100%" stopColor="#ff3b3b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g style={{ transform: `scaleX(${squeeze ? 0.06 : 1})`, transformOrigin: '200px 300px', transition: 'transform .36s cubic-bezier(.65,0,.35,1)' }}>
            <Shoulders tense={!relaxed} />
            {facingBack ? (
              <Back on={on} hint={phase === 'back'} />
            ) : (
              <>
                <FaceFront relaxed={relaxed} tense={!relaxed} />
                <DeviceFront on={on} tense={!relaxed} />
              </>
            )}
          </g>
        </svg>
      </button>

      <div className="px-6 pb-6">
        {relaxed ? (
          <button type="button" onClick={onDone} className="cta w-full">
            Primește cadoul
          </button>
        ) : (
          <p className="flex min-h-[52px] items-center justify-center text-center text-[14px] font-semibold text-muted">{phase === 'back' ? 'Atinge butonul de pe ceafă' : ' '}</p>
        )}
      </div>
    </div>
  )
}
