// Anchor deep-linking into panels. Elementor's anchor machinery is
// vertical-only and every panel shares one vertical position while the
// section is pinned, so links into a panel land at the section top. The pin
// math knows the real destination: map the panel's traversal fraction to a
// document scrollY and take the navigation over. Scroll behaviors are always
// explicit — Elementor's frontend CSS ships `html { scroll-behavior: smooth }`
// (under prefers-reduced-motion: no-preference), which repaces any
// non-explicit programmatic scroll.
import { computeInsetStart, layoutDocTop } from './geometry'

// The frontend bundle also runs inside the editor's preview iframe. No
// deep-link scrolling there: canvas scroll actors are the editor's own
// territory, and scroll-to-panel was deliberately descoped after losing
// a long fight with the editor's stacked scroll actors.
const isEditMode = (): boolean => window.elementorFrontend?.isEditMode?.() === true

export const resolveHashTarget = (hash: string): HTMLElement | null => {
  if (hash.length < 2) {
    return null
  }
  try {
    // getElementById, not querySelector: ids like "#123" are invalid selectors
    return document.getElementById(decodeURIComponent(hash.slice(1)))
  } catch {
    return null
  }
}

// The track child the target sits in (or is); null when the target is the
// track/wrapper itself — section-level anchors stay native.
export const resolvePanel = (target: HTMLElement, track: HTMLElement): HTMLElement | null => {
  let node = target
  while (node.parentElement && node.parentElement !== track) {
    node = node.parentElement
  }
  return node.parentElement === track ? node : null
}

// measure() writes a plain px value; render() prints a cqw-based calc
// ESTIMATE on the same inline property as the no-JS fallback — so "non-empty"
// is not "measured". A cold load can reach the correction before measure()
// (readyState even hits complete first, skipping the load repass), and the
// estimate-era runway height lands the page hundreds of px short.
const hasMeasuredDistance = (wrapper: HTMLElement): boolean =>
  /^[\d.]+px$/.test(wrapper.style.getPropertyValue('--arts-hs-distance').trim())

// Document scrollY at which the panel is on stage; null means "leave the
// navigation to the browser" — vertical states, zero travel, or before the
// engine's first measure() (the wrapper height still rides the server-side
// distance estimate then, so the runway math would be wrong).
const computeTargetScrollY = (
  wrapper: HTMLElement,
  track: HTMLElement,
  panel: HTMLElement
): number | null => {
  if (!hasMeasuredDistance(wrapper)) {
    return null
  }
  if (getComputedStyle(track).position !== 'sticky') {
    return null
  }
  const distance = track.scrollWidth - wrapper.clientWidth
  const pinWindow = wrapper.offsetHeight - track.offsetHeight
  if (distance <= 0 || pinWindow <= 0) {
    return null
  }
  // Flush-on-stage fraction: the panel's offset from the traversal-start edge
  // of the track — not the contract's --arts-hs-panel-start, which is the
  // about-to-enter point. Clamped: a last panel narrower than the leftover
  // viewport lands at pin release instead.
  const inverted = getComputedStyle(wrapper).getPropertyValue('--arts-hs-dir').trim() === '-1'
  const raw = inverted
    ? (track.scrollWidth - panel.offsetLeft - panel.offsetWidth) / distance
    : panel.offsetLeft / distance
  const fraction = Math.min(1, Math.max(0, raw))

  // Layout-tree offset, not a rect: an entrance animation on the widget is
  // mid-transform exactly when the deep-link load correction runs.
  const engage = layoutDocTop(wrapper) - computeInsetStart(wrapper, track)
  return engage + fraction * pinWindow
}

const resolveContext = (
  hash: string
): { wrapper: HTMLElement; track: HTMLElement; panel: HTMLElement } | null => {
  const target = resolveHashTarget(hash)
  const wrapper = target?.closest<HTMLElement>('.js-arts-hs')
  if (!target || !wrapper) {
    return null
  }
  const track = wrapper.querySelector<HTMLElement>('.js-arts-hs__track')
  const panel = track ? resolvePanel(target, track) : null
  if (!track || !panel) {
    return null
  }
  return { wrapper, track, panel }
}

const resolveTop = (hash: string): number | null => {
  const ctx = resolveContext(hash)
  return ctx ? computeTargetScrollY(ctx.wrapper, ctx.track, ctx.panel) : null
}

const handleClick = (event: MouseEvent): void => {
  if (isEditMode()) {
    return
  }
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }
  const anchor =
    event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href*="#"]') : null
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
  // keep working, and Elementor's classic anchors handler is not bound in
  // current core (verified live). pushState instead of assigning location.hash
  // — hash assignment triggers a native fragment scroll that would race ours
  // under `scroll-behavior: smooth`.
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
    ctx.wrapper.addEventListener('arts-hs:ready', run, { once: true })
  }
}

document.addEventListener('click', handleClick, { capture: true })
window.addEventListener('elementor/frontend/init', initLoadCorrection)
