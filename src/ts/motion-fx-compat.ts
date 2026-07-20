// Elementor Pro Motion FX correction. Pro derives every viewport-range
// scrolling effect (element and background alike) from the element's vertical
// viewport position via one core utility — a position that stops changing
// while the section is pinned, freezing the effects. Wrap that utility: for
// elements inside an actively scrubbing section, return the x-axis mirror of
// the same formula measured against the wrapper (the stage), so effects
// respond to horizontal traversal instead. Pro's Progress Tracker rides the
// same utility — pointed at a section itself it is answered with true pin
// progress (see the section-level branch). Everywhere else — outside our
// sections, vertical states, zero travel — the original runs untouched.

interface ITrackState {
  active: boolean
  inverted: boolean
  insetStart: number
  pinWindow: number
}

const states = new WeakMap<HTMLElement, ITrackState>()

/** Written by the engine's measure() — the wrapper stays per-frame cheap. */
export const updateTrackState = (wrapper: HTMLElement, state: ITrackState): void => {
  states.set(wrapper, state)
}

// Mirror of core's vertical formula (rounding included): 0 as the leading
// edge touches the stage, 100 as the trailing edge leaves it. The stage is
// the wrapper, not the viewport — boxed instances scrub inside their own box.
const horizontalPercentage = (el: Element, wrapper: HTMLElement, inverted: boolean): number => {
  const rect = el.getBoundingClientRect()
  const stage = wrapper.getBoundingClientRect()
  const range = stage.width + rect.width
  if (range <= 0) {
    return 0
  }
  let percent = Math.min(1, Math.max(0, (stage.right - rect.left) / range))
  if (inverted) {
    percent = 1 - percent
  }
  return Number.parseFloat((percent * 100).toFixed(2))
}

// True pin progress: 0 as the wrapper's top reaches the sticky offset (pin
// engage), 100 at release — the contract's contain 0% → contain 100%. The
// wrapper is the runway in normal flow, so its rect keeps moving while the
// track sits pinned; the traversal direction never inverts this axis.
const pinProgress = (wrapper: HTMLElement, state: ITrackState): number => {
  const top = wrapper.getBoundingClientRect().top
  const percent = Math.min(1, Math.max(0, (state.insetStart - top) / state.pinWindow))
  return Number.parseFloat((percent * 100).toFixed(2))
}

let installed = false

const install = (): void => {
  const scroll = window.elementorModules?.utils?.Scroll
  const original = scroll?.getElementViewportPercentage
  if (installed || !scroll || typeof original !== 'function') {
    return
  }
  installed = true
  scroll.getElementViewportPercentage = function (
    $element: { 0?: Element },
    offsetObj?: { start?: number; end?: number }
  ): number {
    // Nothing may escape: a throw here would kill Pro's rAF loop. The
    // incoming vh-based offsets are deliberately dropped on the corrected
    // path — Motion FX's scroll interaction never passes any.
    try {
      const el = $element?.[0]
      // Duck-typed, not instanceof: in the editor preview a re-rendered
      // element comes from the parent window's realm, where a same-realm
      // instanceof check is false on the first re-render.
      const wrapper =
        el && typeof el.closest === 'function' ? el.closest<HTMLElement>('.js-arts-hs') : null
      const state = wrapper ? states.get(wrapper) : undefined
      if (el && wrapper && state?.active) {
        // The wrapper and track ARE the pin, not content riding it — the
        // horizontal mirror degenerates on them (rect == stage → constant
        // 50). Progress Tracker's Selector mode queries them with its
        // signature offsets ({start: 0, end: -100}) and wants pin progress.
        // Motion FX passes no offsets, and for it the wrapper is a normal
        // tall block whose vertical math is already right — original.
        if (el === wrapper || el.classList.contains('js-arts-hs__track')) {
          if (offsetObj?.end === -100 && state.pinWindow > 0) {
            return pinProgress(wrapper, state)
          }
          return original.call(this, $element, offsetObj)
        }
        return horizontalPercentage(el, wrapper, state.inverted)
      }
    } catch {
      // fall through to the original
    }
    return original.call(this, $element, offsetObj)
  }
}

window.addEventListener('elementor/frontend/init', install)
