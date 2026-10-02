/** Minimum time on screen (ms), so the intro plays in full even on a fast connection. */
const MIN_MS = 2400
/** Safety net: the site shows by then, whatever is still loading. */
const MAX_MS = 8000

/**
 * The opening of the store, once per visit (per browser tab): the wordmark letter by letter and a hairline
 * that fills while the page loads, then the curtain lifts onto the photograph. Every movement is transform
 * or opacity, so it stays smooth on the compositor while the page hydrates underneath. It waits for the window
 * `load` event (images, fonts) and at least MIN_MS, never more than MAX_MS.
 *
 * Rendered by the server and driven by a few lines of inline script that run before the first paint, so
 * nothing flashes: the curtain is hidden by default (CSS) and only the script shows it. Without
 * JavaScript, or on the second page of a visit, the site appears directly. State lives on <html
 * data-pl>, which React does not manage, so hydration is untouched. Landings and the checkout do not use it.
 */
export function Preloader() {
  const script = `(function(){var d=document.documentElement,k='bt-intro';try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1')}catch(e){}d.setAttribute('data-pl','on');var done=0;function out(){if(done)return;done=1;d.setAttribute('data-pl','out');setTimeout(function(){d.setAttribute('data-pl','done')},1300)}function ready(){setTimeout(out,Math.max(0,${MIN_MS}-performance.now()))}if(document.readyState==='complete')ready();else addEventListener('load',ready);setTimeout(out,${MAX_MS})})()`
  return (
    <>
      <div id="preloader" aria-hidden="true">
        <span className="pl-glow" />
        <span className="pl-mark">
          {'BIOHACK'.split('').map((c, i) => (
            <span key={i} className="pl-l" style={{ '--i': i } as React.CSSProperties}>
              {c}
            </span>
          ))}
          <span className="pl-gap" />
          {'TECH'.split('').map((c, i) => (
            <span key={i} className="pl-l text-cyan" style={{ '--i': i + 8 } as React.CSSProperties}>
              {c}
            </span>
          ))}
        </span>
        <span className="pl-track">
          <span className="pl-fill" />
        </span>
      </div>
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  )
}
