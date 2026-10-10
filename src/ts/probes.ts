// The documented reads of the contract (README points integrators at the same
// track-position check `isScrubbing` performs) and the DOM resolution every
// module shares. Internal: kept out of ./contract, which stays DOM-free.

import { TRACK_SELECTOR, VAR_DIR, WRAPPER_SELECTOR } from './contract'

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

// The px the track must travel for its trailing edge to land. The track's own
// box, never scrollWidth: the slide is `-100% + 100cqw`, a % of that box, so
// content overflowing the last panel is never travelled to — counting it made
// the runway, and every scroll position mapped onto it, outrun the real slide.
export const distanceOf = (wrapper: HTMLElement, track: HTMLElement): number =>
  Math.max(0, track.offsetWidth - wrapper.clientWidth)

// The scroll span the pin occupies: runway height minus the pinned track's.
export const pinWindowOf = (wrapper: HTMLElement, track: HTMLElement): number =>
  wrapper.offsetHeight - track.offsetHeight

// The frontend bundle also runs inside the editor's preview iframe, where
// canvas scroll actors are the editor's own territory. Read through a local
// cast: this module is part of the standalone package, which never sees the
// producer's Elementor globals — outside Elementor this is simply false.
export const isEditMode = (): boolean =>
  (
    window as { elementorFrontend?: { isEditMode?: () => boolean } }
  ).elementorFrontend?.isEditMode?.() === true

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
