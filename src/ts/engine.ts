// Frontend engine. The scroll mechanics are pure CSS — this module only
// measures (one ResizeObserver per instance writing the distance, inset and
// per-panel range vars, then announcing arts-hs:layout) and, on browsers
// without native support, waits for the shared polyfill loader and
// constructs the one track animation via its WAAPI surface.

import { dropPinFrames } from './anchor-scroll'
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
// part of the standalone package. The shared arts/scroll-timeline-polyfill
// loader publishes the ready promise in every browser and installs
// ViewTimeline only where it is missing. Read at call time, so importing the
// engine touches nothing.
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
interface IPanelRange {
  panel: HTMLElement
  start: string
  end: string
}

// The read half: every panel's offsets against the runway, no writes. Reads
// and writes are split because a style write followed by a layout read forces
// a synchronous recalc, and this loop used to alternate them per panel (N+2
// forced flushes per measure: ~200 ms at 4x in the boot task of a two-section
// page, ~3 s over a 20-step resize storm there).
export const readPanelRanges = (
  wrapper: HTMLElement,
  track: HTMLElement,
  distance: number,
  inverted: boolean
): IPanelRange[] => {
  const viewport = wrapper.clientWidth
  const ranges: IPanelRange[] = []
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
    ranges.push({
      panel,
      start: `${(clamp01(start) * 100).toFixed(3)}%`,
      end: `${(clamp01(end) * 100).toFixed(3)}%`
    })
  }
  return ranges
}

// An inline custom property write only when the value changes: an unchanged
// write still dirties the element's style (and here the whole panel subtree
// that inherits the var).
const setInlineVar = (el: HTMLElement, name: string, value: string): void => {
  if (el.style.getPropertyValue(name) !== value) {
    el.style.setProperty(name, value)
  }
}

export const writePanelRanges = (ranges: IPanelRange[]): void => {
  for (const { panel, start, end } of ranges) {
    setInlineVar(panel, '--arts-hs-panel-start', start)
    setInlineVar(panel, '--arts-hs-panel-end', end)
  }
}

export const stampPanelRanges = (
  wrapper: HTMLElement,
  track: HTMLElement,
  distance: number,
  inverted: boolean
): void => {
  writePanelRanges(readPanelRanges(wrapper, track, distance, inverted))
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
  // Every read first, every write after: none of the writes below changes
  // layout (the sizer derives the runway from the track in CSS; the distance
  // var is the contract's, the inset var feeds the view timeline, the panel
  // vars are animation ranges), so the reads are current before them, and a
  // read after a write would pay a forced style + layout flush.
  dropPinFrames()
  const distance = distanceOf(wrapper, track)
  const insetStart = computeInsetStart(wrapper, track)
  const inverted = isInverted(wrapper)
  const ranges = readPanelRanges(wrapper, track, distance, inverted)
  // Zero travel means the section behaves like a normal block, where Pro's
  // own vertical math is the correct answer again — hence the distance gate.
  const horizontal = distance > 0 && isScrubbing(track)
  const pinWindow = pinWindowOf(wrapper, track)

  setInlineVar(wrapper, VAR_DISTANCE, `${distance}px`)
  setInlineVar(wrapper, '--arts-hs-inset-start', `${insetStart}px`)
  writePanelRanges(ranges)
  updateTrackState(wrapper, {
    active: horizontal,
    inverted,
    insetStart,
    pinWindow
  })
  // Before the announcement: its listeners re-bind through getTimeline(), and a
  // ViewTimeline's inset is fixed at construction. Native tier only — the
  // polyfilled track's scrub is bound to its entry, which must stay put.
  if (SUPPORTS_NATIVE && timelines.get(wrapper)?.inset !== insetStart) {
    timelines.delete(wrapper)
  }
  announceLayout(wrapper, { distance, pinWindow, insetStart, horizontal })
}

const observe = (wrapper: HTMLElement, instance: IInstance): void => {
  const { track } = instance
  const ro = new ResizeObserver(() => {
    // Removing an observed element reports a 0x0 box, which is the only signal
    // frontend code gets that an editor re-render replaced this section — a
    // re-render builds a new wrapper, and without this each old one stays
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
    // Next frame, never here: measure() announces `arts-hs:layout`, and its
    // listeners (trigger refreshes, effects switching mode) and integrators'
    // CSS reading the vars can resize observed boxes (and <body>) mid-delivery,
    // which the browser reports as a ResizeObserver loop error on window for
    // every such resize. Stepping this observer aside can't help — the guard
    // is document-wide, and the polyfill (subject + source children) and
    // smooth-scroll libraries observe those same boxes. The runway itself is
    // already current (the stylesheet's sizer); only the vars lag a frame.
    cancelAnimationFrame(instance.frame)
    instance.frame = requestAnimationFrame(() => measure(wrapper, track))
  })
  instance.observer = ro
  ro.observe(wrapper)
  ro.observe(track)
  measure(wrapper, track)
}

// The inset each timeline was built with travels along, so measure() can tell
// when the sticky offset or the admin-bar margin has outgrown it.
const timelines = new WeakMap<HTMLElement, { timeline: AnimationTimeline; inset: number }>()

// Mirror the stylesheet's explicit view-timeline-inset, so ambient
// scroll-padding (WP admin bar) can't shift the range and top-of-page
// placements don't pre-translate. Null when no ViewTimeline exists at all —
// neither tier can bind a timeline then.
const createViewTimeline = (
  wrapper: HTMLElement,
  inset: number
): { timeline: AnimationTimeline; inset: number } | null => {
  const Ctor = host().ViewTimeline
  if (!Ctor) {
    return null
  }
  return { timeline: new Ctor({ subject: wrapper, axis: 'block', inset: `${inset}px 0px` }), inset }
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
    // A fresh read: the polyfilled scrub is built before the section's first measure().
    const built = createViewTimeline(wrapper, computeInsetStart(wrapper, track))
    if (!built) {
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
      // The `as any` is vestigial: the installed lib.dom now types timeline/rangeStart/rangeEnd
      {
        timeline: built.timeline,
        rangeStart: 'contain 0%',
        rangeEnd: 'contain 100%',
        easing: 'linear',
        fill: 'both'
      } as any
    )
    timelines.set(wrapper, built)
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
    return cached.timeline
  }
  if (!SUPPORTS_NATIVE) {
    return null
  }
  // The inset measure() wrote to --arts-hs-inset-start, never a fresh read: the
  // JS timeline then mirrors the CSS one exactly and is replaced only when
  // measure() announces (a transient layout read here could build an inset no
  // snapshot matches, which the next measure() would drop without an event),
  // and nothing forces a style + layout flush right after measure()'s writes
  // when a layout listener re-binds. A native boot measures synchronously, so
  // the snapshot exists for every section getTimeline() can reach.
  const snapshot = snapshots.get(wrapper)
  if (!snapshot || !resolveTrack(wrapper)) {
    return null
  }
  const built = createViewTimeline(wrapper, snapshot.insetStart)
  if (built) {
    timelines.set(wrapper, built)
  }
  return built?.timeline ?? null
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
  dropPinFrames()
  clearTrackState(wrapper)
}
