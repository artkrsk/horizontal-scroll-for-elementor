// Frontend engine. The scroll mechanics are pure CSS — this module only
// measures (one ResizeObserver per instance writing --arts-hs-distance)
// and, on browsers without native support, waits for the shared polyfill
// loader and constructs the one track animation via its WAAPI surface (the
// polyfill's CSS-parsing layer mis-maps `contain` ranges on subjects taller
// than the scrollport, so it is never relied on).

import { LAYOUT_EVENT, POLYFILLED_CLASS, READY_EVENT, VAR_DISTANCE } from './contract'
import { clamp01, computeInsetStart } from './geometry'
import {
  distanceOf,
  isInverted,
  isScrubbing,
  pinWindowOf,
  resolveTrack,
  resolveWrapper
} from './probes'
import { clearTrackState, updateTrackState } from './track-state'
import { isHTMLElement } from './utils/isHTMLElement'

// Probe the NAMED timeline syntax the engine actually uses — probing view()
// misclassifies partial implementations. Module scope is load-bearing: the
// polyfill later monkeypatches CSS.supports to claim animation-timeline
// support, so a later probe would report native in Firefox and take the
// wrong path.
const SUPPORTS_NATIVE =
  typeof CSS !== 'undefined' &&
  CSS.supports('view-timeline: --x block') &&
  CSS.supports('animation-timeline: --x') &&
  CSS.supports('animation-range: contain 0% contain 100%')

type TPolyfillState = 'native' | 'polyfilled' | 'unavailable'

// Read through a local cast, never the producer's global.d.ts: this module is
// part of the standalone package. Both are installed by the shared
// arts/scroll-timeline-polyfill loader (ViewTimeline natively, in browsers
// that have it). Read at call time, so importing the engine touches nothing.
const host = () =>
  window as {
    ViewTimeline?: new (options: {
      subject: Element
      axis: string
      inset?: string
    }) => AnimationTimeline
    __artsScrollTimelinePolyfillReady?: Promise<TPolyfillState>
  }

// Everything one mounted section owns, so teardown can release all of it.
interface IInstance {
  track: HTMLElement
  observer: ResizeObserver | null
  frame: number
  animation: Animation | null
}

const instances = new WeakMap<HTMLElement, IInstance>()

// The % window of the pin scrub during which each panel horizontally
// intersects the scrollport: enters when its leading edge crosses the
// viewport edge, exits when its trailing edge leaves. Inverted direction
// mirrors the window. Stamped inline so the values inherit into the
// panel's subtree (a committed surface — README: Integration contract).
export const stampPanelRanges = (
  wrapper: HTMLElement,
  track: HTMLElement,
  distance: number,
  inverted: boolean
): void => {
  const viewport = wrapper.clientWidth
  for (const panel of Array.from(track.children)) {
    // Never instanceof: the editor assembles the canvas in its own window, so
    // inside the preview iframe EVERY panel failed a same-realm check and the
    // whole track went unstamped there. isHTMLElement answers in any realm —
    // but `nodeType === 1` also covers the SVG-shaped children this loop has
    // to skip, so the layout box is tested separately.
    if (!isHTMLElement(panel) || typeof panel.offsetLeft !== 'number') {
      continue
    }
    let start = 0
    let end = 1
    if (distance > 0) {
      const enter = (panel.offsetLeft - viewport) / distance
      const exit = (panel.offsetLeft + panel.offsetWidth) / distance
      start = inverted ? 1 - exit : enter
      end = inverted ? 1 - enter : exit
    }
    panel.style.setProperty('--arts-hs-panel-start', `${(clamp01(start) * 100).toFixed(3)}%`)
    panel.style.setProperty('--arts-hs-panel-end', `${(clamp01(end) * 100).toFixed(3)}%`)
  }
}

interface ILayoutSnapshot {
  distance: number
  pinWindow: number
  insetStart: number
  horizontal: boolean
}

const snapshots = new WeakMap<HTMLElement, ILayoutSnapshot>()

// Themes and runtimes keep their own scroll engines in sync with the runway
// (trigger refreshes, switching an effect between its horizontal and stacked
// mode) — announce only what changed, never per frame. A continuous window
// resize still re-measures every frame, so listeners debounce heavy work.
const announceLayout = (wrapper: HTMLElement, next: ILayoutSnapshot): void => {
  const previous = snapshots.get(wrapper)
  if (
    previous &&
    previous.distance === next.distance &&
    previous.pinWindow === next.pinWindow &&
    previous.insetStart === next.insetStart &&
    previous.horizontal === next.horizontal
  ) {
    return
  }
  snapshots.set(wrapper, next)
  wrapper.dispatchEvent(
    new CustomEvent(LAYOUT_EVENT, {
      bubbles: true,
      detail: { wrapper, horizontal: next.horizontal }
    })
  )
}

export const measure = (wrapper: HTMLElement, track: HTMLElement): void => {
  const distance = distanceOf(wrapper, track)
  wrapper.style.setProperty(VAR_DISTANCE, `${distance}px`)

  const insetStart = computeInsetStart(wrapper, track)
  wrapper.style.setProperty('--arts-hs-inset-start', `${insetStart}px`)

  const inverted = isInverted(wrapper)
  stampPanelRanges(wrapper, track, distance, inverted)

  // Zero travel means the section behaves like a normal block, where Pro's
  // own vertical math is the correct answer again — hence the distance gate.
  // pinWindowOf reads offsetHeight after the fresh --arts-hs-distance write,
  // so the runway height is already current.
  const horizontal = distance > 0 && isScrubbing(track)
  const pinWindow = pinWindowOf(wrapper, track)
  updateTrackState(wrapper, {
    active: horizontal,
    inverted,
    insetStart,
    pinWindow
  })
  announceLayout(wrapper, { distance, pinWindow, insetStart, horizontal })
}

const observe = (wrapper: HTMLElement, instance: IInstance): void => {
  const { track } = instance
  const ro = new ResizeObserver(() => {
    // Removing an observed element reports a 0x0 box, which is the only signal
    // frontend code gets that an editor re-render replaced this section — every
    // settings change builds a new wrapper, and without this each old one stays
    // reachable through its observer with the whole panel tree behind it.
    //
    // CONNECTEDNESS, not that 0x0: a section inside a hidden tab reports the
    // same box and has to keep observing so it re-measures when shown again.
    //
    // Best effort by design. A browser that never reports the box leaves this
    // exactly what it was before — an observer nothing can reach. (A shared
    // observer would be the opposite trade: permanently reachable itself, so it
    // would pin every wrapper it ever saw rather than letting the cycle go.)
    if (!wrapper.isConnected) {
      ro.disconnect()
      return
    }
    // Next frame, never here: the runway height is built from the
    // --arts-hs-distance measure() writes, so a travel change would resize the
    // wrapper (and <body>) mid-delivery, and the browser reports that as a
    // ResizeObserver loop error on window for every such resize. Stepping this
    // observer aside can't help — the guard is document-wide, and the polyfill
    // (subject + source children) and smooth-scroll libraries observe those
    // same boxes. Written before the next layout, every observer sees the new
    // height in its first pass. Cost: that one frame paints the old runway.
    cancelAnimationFrame(instance.frame)
    instance.frame = requestAnimationFrame(() => measure(wrapper, track))
  })
  instance.observer = ro
  ro.observe(wrapper)
  ro.observe(track)
  measure(wrapper, track)
}

const timelines = new WeakMap<HTMLElement, AnimationTimeline>()

// Mirror the stylesheet's explicit view-timeline-inset, so ambient
// scroll-padding (WP admin bar) can't shift the range and top-of-page
// placements don't pre-translate. Null when no ViewTimeline exists at all —
// neither tier can bind a timeline then.
const createViewTimeline = (wrapper: HTMLElement, track: HTMLElement): AnimationTimeline | null => {
  const Ctor = host().ViewTimeline
  if (!Ctor) {
    return null
  }
  return new Ctor({
    subject: wrapper,
    axis: 'block',
    inset: `${computeInsetStart(wrapper, track)}px 0px`
  })
}

// Endpoints are %/cqw/var-based, so they re-resolve against current boxes on
// every tick — built once per instance, never rebuilt on resize. The vertical
// states neutralize it through --arts-hs-move: 0 in the same calc.
//
// Returns the running scrub, or null — belt-and-braces: the loader resolves
// 'polyfilled' only once ViewTimeline exists, and the shared polyfill is
// patched so one hostile stylesheet no longer aborts its whole init (stock
// upstream did — Elementor's own inline CSS is such a sheet). Without the
// timeline the track would pin and never move, so on failure the caller must
// keep the vertical layout instead.
const buildPolyfillAnimation = (wrapper: HTMLElement, track: HTMLElement): Animation | null => {
  try {
    const timeline = createViewTimeline(wrapper, track)
    if (!timeline) {
      return null
    }
    const animation = track.animate(
      [
        { transform: 'translateX(0px)' },
        {
          transform:
            'translateX(calc((-100% + 100cqw) * var(--arts-hs-dir, 1) * var(--arts-hs-move, 1)))'
        }
      ],
      // Vestigial: the installed lib.dom now types timeline/rangeStart/rangeEnd
      {
        timeline,
        rangeStart: 'contain 0%',
        rangeEnd: 'contain 100%',
        easing: 'linear',
        fill: 'both'
      } as any
    )
    timelines.set(wrapper, timeline)
    return animation
  } catch {
    return null
  }
}

// The shared arts/scroll-timeline-polyfill loader owns fetching and installing
// the polyfill (one copy per page, however many Arts plugins ask for it) and
// publishes this promise. We depend on its script handle, so it has always run
// by the time ours does.
const polyfillState = (): Promise<TPolyfillState> =>
  host().__artsScrollTimelinePolyfillReady ?? Promise.resolve('unavailable')

// The README contract's JS path — one implementation across tiers. Native constructs lazily on
// demand; polyfilled reuses the instance buildPolyfillAnimation already made
// for the track (descendant CSS bindings don't work under the polyfill —
// its CSS-parsing layer is the broken path).
export const getTimeline = (el: Element): AnimationTimeline | null => {
  const wrapper = resolveWrapper(el)
  if (!wrapper || !instances.has(wrapper)) {
    return null
  }
  const cached = timelines.get(wrapper)
  if (cached) {
    return cached
  }
  if (!SUPPORTS_NATIVE) {
    return null
  }
  const track = resolveTrack(wrapper)
  if (!track) {
    return null
  }
  const timeline = createViewTimeline(wrapper, track)
  if (timeline) {
    timelines.set(wrapper, timeline)
  }
  return timeline
}

const announce = (wrapper: HTMLElement): void => {
  wrapper.dispatchEvent(new CustomEvent(READY_EVENT, { bubbles: true, detail: { wrapper } }))
}

export const boot = (wrapper: HTMLElement): void => {
  if (instances.has(wrapper)) {
    return
  }

  const track = resolveTrack(wrapper)
  if (!track) {
    return
  }
  const instance: IInstance = { track, observer: null, frame: 0, animation: null }
  instances.set(wrapper, instance)

  if (SUPPORTS_NATIVE) {
    observe(wrapper, instance)
    announce(wrapper)
    return
  }

  polyfillState().then((state) => {
    // Torn down (or torn down and booted afresh) while the polyfill loaded:
    // building now would drive a section nobody owns, or drive it twice.
    if (instances.get(wrapper) !== instance || state !== 'polyfilled') {
      // No timelines to drive the track with: the designed vertical layout
      // stays in place and content is never trapped behind the clipped pin.
      return
    }
    // Flip layout FIRST: the animation's inset mirrors the sticky top, which
    // only resolves once the track is sticky. Both happen in this one task, so
    // nothing paints in between — and if the build still fails, the class comes
    // straight back off rather than leaving a pinned track that never scrubs.
    wrapper.classList.add(POLYFILLED_CLASS)
    instance.animation = buildPolyfillAnimation(wrapper, track)
    if (!instance.animation) {
      wrapper.classList.remove(POLYFILLED_CLASS)
      return
    }
    observe(wrapper, instance)
    announce(wrapper)
  })
}

// Releases what boot() took: observer, pending frame, the polyfilled scrub
// and its layout flip, and every per-section cache — so booting the same
// wrapper again announces ready and layout afresh (consumers key their own
// first-measure state off those events). Measured inline vars stay: they are
// inert in the stacked layout and still exact where CSS keeps scrubbing.
export const teardown = (wrapper: HTMLElement): void => {
  const instance = instances.get(wrapper)
  if (!instance) {
    return
  }
  instances.delete(wrapper)
  instance.observer?.disconnect()
  cancelAnimationFrame(instance.frame)
  if (instance.animation) {
    instance.animation.cancel()
    wrapper.classList.remove(POLYFILLED_CLASS)
  }
  timelines.delete(wrapper)
  snapshots.delete(wrapper)
  clearTrackState(wrapper)
}
