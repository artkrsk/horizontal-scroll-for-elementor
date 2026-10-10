// The committed public surface in one place, and the package's `/contract`
// entry: constants and types only — no DOM access, no globals, no engine. The
// names README.md's Integration contract table lists cannot be renamed without
// bumping `window.artsHorizontalScroll.contract`; the documented reads of them
// (the track-position check `isScrubbing` performs, …) live in ./probes. Two
// names here are NOT in that table: WIDGET_TYPE, the Elementor type name
// phpParity.test.ts pins against PHP's get_name(), and POLYFILLED_CLASS.
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
export const LAYOUT_EVENT = 'arts-hs:layout'
export const WIDGET_TYPE = 'arts-horizontal-scroll'
export const VAR_DISTANCE = '--arts-hs-distance'
export const VAR_DIR = '--arts-hs-dir'

/** What `getScrollRange()` answers: a document scrollY window. */
export interface IHorizontalScrollRange {
  start: number
  end: number
  /** The target is already on stage as the pin engages; `start` is then the engage point. */
  onStageAtEngage: boolean
}

/** `window.artsHorizontalScroll` — README: Integration contract. */
export interface IArtsHorizontalScrollGlobal {
  /** Integer API level; bumps only on breaking changes. */
  readonly contract: number
  getTimeline(el: Element): AnimationTimeline | null
  getScrollTop(target: Element): number | null
  getScrollRange(target: Element, options?: { inset?: number }): IHorizontalScrollRange | null
}

/** `arts-hs:ready` detail, dispatched on the wrapper. */
export interface IHorizontalScrollReadyDetail {
  wrapper: HTMLElement
}

/** `arts-hs:layout` detail, dispatched on the wrapper. */
export interface IHorizontalScrollLayoutDetail {
  wrapper: HTMLElement
  horizontal: boolean
}
