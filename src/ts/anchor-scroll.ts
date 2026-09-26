// Anchor deep-linking into panels. Elementor's anchor machinery is
// vertical-only and every panel shares one vertical position while the
// section is pinned, so links into a panel land at the section top. The pin
// math knows the real destination: map the panel's traversal fraction to a
// document scrollY and take the navigation over. Scroll behaviors are always
// explicit — Elementor's frontend CSS ships `html { scroll-behavior: smooth }`
// (under prefers-reduced-motion: no-preference), which repaces any
// non-explicit programmatic scroll.
import {
  distanceOf,
  isEditMode,
  isInverted,
  isScrubbing,
  pinWindowOf,
  READY_EVENT,
  resolveHashTarget,
  resolvePanel,
  resolveTrack,
  resolveWrapper,
  VAR_DISTANCE
} from './contract'
import { clamp01, computeInsetStart, layoutDocTop, layoutOffsetLeftWithin } from './geometry'
import { isHTMLElement } from './utils/isHTMLElement'
import { onElementorFrontendInit } from './utils/onElementorFrontendInit'

// No deep-link scrolling inside the editor's preview iframe: canvas scroll
// actors are the editor's own territory, and scroll-to-panel was deliberately
// descoped after losing a long fight with the editor's stacked scroll actors.
// Both entry points below gate on isEditMode().

// measure() writes a plain px value; render() prints a cqw-based calc
// ESTIMATE on the same inline property as the no-JS fallback — so "non-empty"
// is not "measured". A cold load can reach the correction before measure()
// (readyState even hits complete first, skipping the load repass), and the
// estimate-era runway height lands the page hundreds of px short.
const hasMeasuredDistance = (wrapper: HTMLElement): boolean =>
  /^[\d.]+px$/.test(wrapper.style.getPropertyValue(VAR_DISTANCE).trim())

interface IPinFrame {
  distance: number
  pinWindow: number
  engage: number
  inverted: boolean
}

// The traversal every position below maps onto; null means "leave it to the
// browser" — vertical states, zero travel, or before the engine's first
// measure() (the wrapper height still rides the server-side distance estimate
// then, so the runway math would be wrong).
const pinFrame = (wrapper: HTMLElement, track: HTMLElement): IPinFrame | null => {
  if (!hasMeasuredDistance(wrapper)) {
    return null
  }
  if (!isScrubbing(track)) {
    return null
  }
  // distanceOf clamps at 0 where this used to allow a negative; the guard
  // below takes the same early return either way.
  const distance = distanceOf(wrapper, track)
  const pinWindow = pinWindowOf(wrapper, track)
  if (distance <= 0 || pinWindow <= 0) {
    return null
  }
  // Layout-tree offset, not a rect: an entrance animation on the widget is
  // mid-transform exactly when the deep-link load correction runs.
  const engage = layoutDocTop(wrapper) - computeInsetStart(wrapper, track)
  return { distance, pinWindow, engage, inverted: isInverted(wrapper) }
}

// Document scrollY at which the panel is on stage; null when pinFrame is.
export const computeTargetScrollY = (
  wrapper: HTMLElement,
  track: HTMLElement,
  panel: HTMLElement
): number | null => {
  const frame = pinFrame(wrapper, track)
  if (!frame) {
    return null
  }
  // Flush-on-stage fraction: the panel's offset from the traversal-start edge
  // of the track — not the contract's --arts-hs-panel-start, which is the
  // about-to-enter point. Clamped: a last panel narrower than the leftover
  // viewport lands at pin release instead.
  const raw = frame.inverted
    ? (track.offsetWidth - panel.offsetLeft - panel.offsetWidth) / frame.distance
    : panel.offsetLeft / frame.distance
  return frame.engage + clamp01(raw) * frame.pinWindow
}

// Public (README: Integration contract). The document scrollY window during
// which the target crosses the stage — the same enter/exit rule and inversion
// as the per-panel range vars, clamped to the pinned traversal — so a theme can
// hand exact numbers to its own scroll engine instead of reading rects every
// frame. Clamping gives a target already on stage at pin engage the same
// `start` as one whose edge only reaches the stage then (100vw panels put every
// other panel exactly there), yet only the former is seen while the section
// still scrolls vertically — onStageAtEngage tells them apart. `inset` narrows
// the stage from both sides by that fraction of its width, as a negative
// IntersectionObserver rootMargin would: the window then opens once the target
// is that far in and closes that far before it leaves, which is how a reveal
// "trigger point" maps onto sideways travel — mapped here because the scroll
// per pixel of travel (runway factor) and the direction are this engine's.
// Null in the same cases as getScrollTop.
export const getScrollRange = (
  target: Element,
  options?: { inset?: number }
): { start: number; end: number; onStageAtEngage: boolean } | null => {
  const wrapper = resolveWrapper(target)
  const track = wrapper ? resolveTrack(wrapper) : null
  if (!wrapper || !track || !isHTMLElement(target) || target === track || !track.contains(target)) {
    return null
  }
  const frame = pinFrame(wrapper, track)
  const left = frame ? layoutOffsetLeftWithin(target, track) : null
  if (!frame || left === null) {
    return null
  }
  const inset = (options?.inset ?? 0) * wrapper.clientWidth
  const enter = (left - wrapper.clientWidth + inset) / frame.distance
  const exit = (left + target.offsetWidth - inset) / frame.distance
  const [from, to] = frame.inverted ? [1 - exit, 1 - enter] : [enter, exit]
  return {
    start: frame.engage + clamp01(from) * frame.pinWindow,
    end: frame.engage + clamp01(to) * frame.pinWindow,
    // More than a pixel on stage: panel and stage widths both round to whole
    // pixels, so an edge sitting on the stage edge can land a pixel inside it.
    onStageAtEngage: from * frame.distance < -1 && to > 0
  }
}

const contextOf = (
  target: HTMLElement
): { wrapper: HTMLElement; track: HTMLElement; panel: HTMLElement } | null => {
  const wrapper = resolveWrapper(target)
  const track = wrapper ? resolveTrack(wrapper) : null
  const panel = track ? resolvePanel(target, track) : null
  if (!wrapper || !track || !panel) {
    return null
  }
  return { wrapper, track, panel }
}

const resolveContext = (
  hash: string
): { wrapper: HTMLElement; track: HTMLElement; panel: HTMLElement } | null => {
  const target = resolveHashTarget(hash)
  return target ? contextOf(target) : null
}

// Public (README: Integration contract) — lets a theme's own smooth scroller
// land exactly where the anchor-click path would.
export const getScrollTop = (target: Element): number | null => {
  const ctx = isHTMLElement(target) ? contextOf(target) : null
  return ctx ? computeTargetScrollY(ctx.wrapper, ctx.track, ctx.panel) : null
}

const resolveTop = (hash: string): number | null => {
  const target = resolveHashTarget(hash)
  return target ? getScrollTop(target) : null
}

const handleClick = (event: MouseEvent): void => {
  // Another script already took the click — a smooth-scroll library landing
  // the panel through its own engine (a native scroll here would be
  // overwritten by its running animation), a menu, a tab.
  if (event.defaultPrevented || isEditMode()) {
    return
  }
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }
  const anchor = isHTMLElement(event.target)
    ? event.target.closest<HTMLAnchorElement>('a[href*="#"]')
    : null
  if (
    anchor?.target !== '' ||
    anchor.origin !== location.origin ||
    anchor.pathname !== location.pathname ||
    anchor.search !== location.search
  ) {
    return
  }
  const top = resolveTop(anchor.hash)
  if (top === null) {
    return
  }
  // preventDefault only, no stopPropagation: menu-close / analytics listeners
  // keep working, and current core binds no anchor click handler of its own
  // (it only stamps scroll-margin-top and lets the browser scroll natively),
  // so there is nothing of Elementor's to race. pushState instead of assigning
  // location.hash — hash assignment triggers a native fragment scroll that
  // would race ours under `scroll-behavior: smooth`.
  event.preventDefault()
  history.pushState(null, '', anchor.hash)
  window.scrollTo({ top, behavior: 'smooth' })
}

const correctFromLocationHash = (): void => {
  const top = resolveTop(location.hash)
  if (top !== null) {
    window.scrollTo({ top, behavior: 'instant' })
  }
}

// Layout above the section shifts as images load, and the browser re-runs its
// own (wrong) fragment scroll late — the browser's clearance includes WP's
// scroll-padding-top, which core never zeroes below 600px where the admin bar
// goes position: absolute. One more pass at window load gets the final word,
// unless the visitor has taken over scrolling — touchmove, not touchstart: a
// mere tap during load (common on phones) must not cancel the correction.
const armLoadRepass = (): void => {
  if (document.readyState === 'complete') {
    return
  }
  let userScrolled = false
  const mark = (): void => {
    userScrolled = true
  }
  for (const type of ['wheel', 'touchmove', 'keydown']) {
    window.addEventListener(type, mark, { once: true, passive: true })
  }
  window.addEventListener(
    'load',
    () => {
      if (!userScrolled) {
        correctFromLocationHash()
      }
    },
    { once: true }
  )
}

// Page-load deep link: the browser has already scrolled to the section top by
// the time the engine can say better. Correct instantly once the target's
// section has measured — arts-hs:ready is the same signal the integration
// contract points consumers at.
const initLoadCorrection = (): void => {
  if (isEditMode()) {
    return
  }
  const ctx = resolveContext(location.hash)
  if (!ctx) {
    return
  }
  const run = (): void => {
    correctFromLocationHash()
    armLoadRepass()
  }
  if (hasMeasuredDistance(ctx.wrapper)) {
    run()
  } else {
    ctx.wrapper.addEventListener(READY_EVENT, run, { once: true })
  }
}

export const installAnchorScroll = (): void => {
  document.addEventListener('click', handleClick, { capture: true })
  onElementorFrontendInit(initLoadCorrection)
}
