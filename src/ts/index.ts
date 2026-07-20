// Frontend engine bootstrap. The scroll mechanics are pure CSS — this file
// only measures (one ResizeObserver per instance writing --arts-hs-distance)
// and, on browsers without native support, waits for the shared polyfill
// loader and constructs the one track animation via its WAAPI surface (the
// polyfill's CSS-parsing layer mis-maps `contain` ranges on subjects taller
// than the scrollport, so it is never relied on).

import './anchor-scroll'
import './scrollspy'
import { computeInsetStart } from './geometry'
import { updateTrackState } from './motion-fx-compat'

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

const booted = new WeakSet<HTMLElement>()

// The % window of the pin scrub during which each panel horizontally
// intersects the scrollport: enters when its leading edge crosses the
// viewport edge, exits when its trailing edge leaves. Inverted direction
// mirrors the window. Stamped inline so the values inherit into the
// panel's subtree (a committed surface — README: Integration contract).
const stampPanelRanges = (
  wrapper: HTMLElement,
  track: HTMLElement,
  distance: number,
  inverted: boolean
): void => {
  const viewport = wrapper.clientWidth
  for (const child of Array.from(track.children)) {
    if (!(child instanceof HTMLElement)) {
      continue
    }
    let start = 0
    let end = 1
    if (distance > 0) {
      const enter = (child.offsetLeft - viewport) / distance
      const exit = (child.offsetLeft + child.offsetWidth) / distance
      start = inverted ? 1 - exit : enter
      end = inverted ? 1 - enter : exit
    }
    child.style.setProperty(
      '--arts-hs-panel-start',
      `${(Math.min(1, Math.max(0, start)) * 100).toFixed(3)}%`
    )
    child.style.setProperty(
      '--arts-hs-panel-end',
      `${(Math.min(1, Math.max(0, end)) * 100).toFixed(3)}%`
    )
  }
}

let recalcTimer: number | undefined

// Pro's Motion FX caches background-layer dimensions at init/resize only, but
// panels also resize without a window resize (image/font load) — nudge its
// public re-measure event once our geometry settles. Harmless with no
// listeners; trailing debounce absorbs ResizeObserver bursts during load.
const scheduleMotionFxRecalc = (): void => {
  window.clearTimeout(recalcTimer)
  recalcTimer = window.setTimeout(() => {
    window.elementorFrontend?.elements?.$window?.trigger('elementor-pro/motion-fx/recalc')
  }, 100)
}

const measure = (wrapper: HTMLElement, track: HTMLElement): void => {
  const distance = Math.max(0, track.scrollWidth - wrapper.clientWidth)
  wrapper.style.setProperty('--arts-hs-distance', `${distance}px`)

  const insetStart = computeInsetStart(wrapper, track)
  wrapper.style.setProperty('--arts-hs-inset-start', `${insetStart}px`)

  const inverted = getComputedStyle(wrapper).getPropertyValue('--arts-hs-dir').trim() === '-1'
  stampPanelRanges(wrapper, track, distance, inverted)

  // Zero travel means the section behaves like a normal block, where Pro's
  // own vertical math is the correct answer again — hence the distance gate.
  // pinWindow reads offsetHeight after the fresh --arts-hs-distance write,
  // so the runway height is already current (same formula as anchor-scroll).
  updateTrackState(wrapper, {
    active: distance > 0 && getComputedStyle(track).position === 'sticky',
    inverted,
    insetStart,
    pinWindow: wrapper.offsetHeight - track.offsetHeight
  })
  scheduleMotionFxRecalc()
}

const observe = (wrapper: HTMLElement, track: HTMLElement): void => {
  const ro = new ResizeObserver(() => measure(wrapper, track))
  ro.observe(wrapper)
  ro.observe(track)
  measure(wrapper, track)
}

const timelines = new WeakMap<HTMLElement, AnimationTimeline>()

// Endpoints are %/cqw/var-based, so they re-resolve against current boxes on
// every tick — built once per instance, never rebuilt on resize. The vertical
// states neutralize it through --arts-hs-move: 0 in the same calc.
//
// Reports whether the scrub is actually running — belt-and-braces: the
// loader resolves 'polyfilled' only once ViewTimeline exists, and the shared
// polyfill is patched so one hostile stylesheet no longer aborts its whole
// init (stock upstream did — Elementor's own inline CSS is such a sheet).
// Without the timeline the track would pin and never move, so on failure
// the caller must keep the vertical layout instead.
const buildPolyfillAnimation = (wrapper: HTMLElement, track: HTMLElement): boolean => {
  if (!window.ViewTimeline) {
    return false
  }
  try {
    // Mirror the stylesheet's explicit view-timeline-inset, so ambient
    // scroll-padding (WP admin bar) can't shift the range and top-of-page
    // placements don't pre-translate.
    const timeline = new window.ViewTimeline({
      subject: wrapper,
      axis: 'block',
      inset: `${computeInsetStart(wrapper, track)}px 0px`
    })
    track.animate(
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
    return true
  } catch {
    return false
  }
}

// The shared arts/scroll-timeline-polyfill loader owns fetching and installing
// the polyfill (one copy per page, however many Arts plugins ask for it) and
// publishes this promise. We depend on its script handle, so it has always run
// by the time ours does.
const polyfillState = (): Promise<string> =>
  window.__artsScrollTimelinePolyfillReady ?? Promise.resolve('unavailable')

// The README contract's JS path — one implementation across tiers. Native constructs lazily on
// demand; polyfilled reuses the instance buildPolyfillAnimation already made
// for the track (descendant CSS bindings don't work under the polyfill —
// its CSS-parsing layer is the broken path).
const getTimeline = (el: Element): AnimationTimeline | null => {
  const wrapper = el.closest<HTMLElement>('.js-arts-hs')
  if (!wrapper || !booted.has(wrapper)) {
    return null
  }
  const cached = timelines.get(wrapper)
  if (cached) {
    return cached
  }
  if (!SUPPORTS_NATIVE || !window.ViewTimeline) {
    return null
  }
  const track = wrapper.querySelector<HTMLElement>('.js-arts-hs__track')
  if (!track) {
    return null
  }
  const timeline = new window.ViewTimeline({
    subject: wrapper,
    axis: 'block',
    inset: `${computeInsetStart(wrapper, track)}px 0px`
  })
  timelines.set(wrapper, timeline)
  return timeline
}

const announce = (wrapper: HTMLElement): void => {
  wrapper.dispatchEvent(new CustomEvent('arts-hs:ready', { bubbles: true, detail: { wrapper } }))
}

const boot = (wrapper: HTMLElement): void => {
  if (booted.has(wrapper)) {
    return
  }
  booted.add(wrapper)

  const track = wrapper.querySelector<HTMLElement>('.js-arts-hs__track')
  if (!track) {
    return
  }

  if (SUPPORTS_NATIVE) {
    observe(wrapper, track)
    announce(wrapper)
    return
  }

  polyfillState().then((state) => {
    if (state !== 'polyfilled') {
      // No timelines to drive the track with: the designed vertical layout
      // stays in place and content is never trapped behind the clipped pin.
      return
    }
    // Flip layout FIRST: the animation's inset mirrors the sticky top, which
    // only resolves once the track is sticky. Both happen in this one task, so
    // nothing paints in between — and if the build still fails, the class comes
    // straight back off rather than leaving a pinned track that never scrubs.
    wrapper.classList.add('arts-hs_polyfilled')
    if (!buildPolyfillAnimation(wrapper, track)) {
      wrapper.classList.remove('arts-hs_polyfilled')
      return
    }
    observe(wrapper, track)
    announce(wrapper)
  })
}

window.ARTS_HS = { ...window.ARTS_HS, contract: 1, getTimeline }

window.addEventListener('elementor/frontend/init', () => {
  window.elementorFrontend.hooks.addAction(
    'frontend/element_ready/arts-horizontal-scroll.default',
    ($scope: unknown) => {
      const el = (($scope as { 0?: HTMLElement })[0] ?? $scope) as HTMLElement
      const wrapper = el.classList?.contains('js-arts-hs')
        ? el
        : el.querySelector<HTMLElement>('.js-arts-hs')
      if (wrapper) {
        boot(wrapper)
      }
    }
  )
})
