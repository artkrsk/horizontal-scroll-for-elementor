// The committed public surface in one place. The names README.md's Integration
// contract table lists cannot be renamed without bumping
// `window.ARTS_HS.contract`; the probes underneath are the documented reads of
// them (the README points integrators at the same track-position check
// `isScrubbing` performs). Two names here are NOT in that table: WIDGET_TYPE,
// the Elementor type name phpParity.test.ts pins against PHP's get_name(), and
// POLYFILLED_CLASS.
//
// DOM hooks are the `js-` family; `.arts-hs*` classes are styling-only and are
// never selected from JS, though JS may still TOGGLE a styling modifier —
// which is why POLYFILLED_CLASS lives here too.

export const WRAPPER_CLASS = 'js-arts-hs'
export const TRACK_CLASS = 'js-arts-hs__track'
export const WRAPPER_SELECTOR = `.${WRAPPER_CLASS}`
export const TRACK_SELECTOR = `.${TRACK_CLASS}`
export const POLYFILLED_CLASS = 'arts-hs_polyfilled'
export const READY_EVENT = 'arts-hs:ready'
export const WIDGET_TYPE = 'arts-horizontal-scroll'
export const VAR_DISTANCE = '--arts-hs-distance'
export const VAR_DIR = '--arts-hs-dir'

export const resolveWrapper = (el: Element): HTMLElement | null =>
  el.closest<HTMLElement>(WRAPPER_SELECTOR)

export const resolveTrack = (wrapper: HTMLElement): HTMLElement | null =>
  wrapper.querySelector<HTMLElement>(TRACK_SELECTOR)

// The README's state probe: `sticky` means the horizontal engine is active,
// `static` means a vertical state (touch devices, a vertical Layout
// breakpoint, a browser without support).
export const isScrubbing = (track: HTMLElement): boolean =>
  getComputedStyle(track).position === 'sticky'

// An RTL page (Direction: Auto) and a forced Right to Left both mirror the
// traversal — the stylesheet owns the sign, this only reads it.
export const isInverted = (wrapper: HTMLElement): boolean =>
  getComputedStyle(wrapper).getPropertyValue(VAR_DIR).trim() === '-1'

// The px the track must travel for its trailing edge to land.
export const distanceOf = (wrapper: HTMLElement, track: HTMLElement): number =>
  Math.max(0, track.scrollWidth - wrapper.clientWidth)

// The scroll span the pin occupies: runway height minus the pinned track's.
export const pinWindowOf = (wrapper: HTMLElement, track: HTMLElement): number =>
  wrapper.offsetHeight - track.offsetHeight

// The frontend bundle also runs inside the editor's preview iframe, where
// canvas scroll actors are the editor's own territory.
export const isEditMode = (): boolean => window.elementorFrontend?.isEditMode?.() === true

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
