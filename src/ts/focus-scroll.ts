// Keyboard focus inside the track. A control the scrub has parked off stage is
// out of reach of the browser's own focus scroll: the runway clips with
// overflow-x: clip, which is no scroll container, and vertically the pinned
// stage is already in view — so Tab moves focus while the page stands still and
// the focus ring is never seen. The pin math knows the scrollY that brings the
// control on stage, as it does for anchor links.
import { getScrollRange } from './anchor-scroll'
import type { IHorizontalScrollRange } from './contract'
import { clamp01 } from './geometry'
import { isEditMode, resolveWrapper } from './probes'
import { isHTMLElement } from './utils/isHTMLElement'

/** Subpixel slack, in px: a control flush with a stage edge is on stage. */
const SLACK = 1

// Rects below, not the layout offsets the range math uses: the question is
// where the control is on screen right now, and a panel's own carousel, inner
// scroller or scroll-driven effect moves it without touching its offsets.

/** A control wider than the stage is on stage once it spans it. */
const isOnStage = (stage: DOMRect, box: DOMRect): boolean =>
  box.width > stage.width
    ? box.left <= stage.left + SLACK && box.right >= stage.right - SLACK
    : box.left >= stage.left - SLACK && box.right <= stage.right + SLACK

// The scrollY at which the target has its place on stage: centred — where
// Chromium's own focus scroll puts a control it had to bring in — or, wider
// than the stage, leading with the edge the traversal starts from.
const placeOnStage = (stage: DOMRect, box: DOMRect, range: IHorizontalScrollRange): number => {
  let dx = box.left + box.width / 2 - (stage.left + stage.width / 2)
  if (box.width > stage.width) {
    dx = range.direction === 1 ? box.left - stage.left : box.right - stage.right
  }
  const span = range.release - range.engage
  const progress =
    clamp01((window.scrollY - range.engage) / span) + (range.direction * dx) / range.distance
  return range.engage + clamp01(progress) * span
}

export const installFocusScroll = (signal: AbortSignal): void => {
  // Whether a scroll of ours is still on its way. Only the browser can say when
  // it has ended — the main thread sees a compositor-driven flight late and in
  // steps (Gecko: the same scrollY over consecutive frames mid-flight), and a
  // flag that outlived the landing once had this module stop the browser's own
  // vertical focus scroll short of the control. So the flag lives from our
  // scrollTo to the next scrollend, and stays down where that event does not
  // exist.
  let flying = false
  const hearsLanding = 'onscrollend' in window
  window.addEventListener(
    'scrollend',
    () => {
      flying = false
    },
    { signal }
  )

  const follow = (wrapper: HTMLElement, target: HTMLElement): void => {
    // Null in vertical states, before the first measure and for a fixed or
    // detached target: the browser's own focus scroll is right there.
    const range = getScrollRange(target)
    if (!range) {
      return
    }
    const stage = wrapper.getBoundingClientRect()
    const box = target.getBoundingClientRect()
    // On stage is done — unless our smooth scroll for the control focused a
    // moment ago is still in flight (Tab, then Shift+Tab before the landing):
    // it would carry this one off again, so this one becomes its destination.
    if (isOnStage(stage, box) && !flying) {
      return
    }
    const top = placeOnStage(stage, box, range)
    // Less than a pixel moves nothing, and nothing would report its end.
    flying = hearsLanding && Math.abs(top - window.scrollY) >= 1
    // `auto` on purpose, the one non-explicit behavior in the engine: the
    // page's scroll-behavior paces this exactly as it paces the browser's own
    // focus scroll everywhere else on the page. Elementor's smooth default sits
    // behind prefers-reduced-motion, so that preference is honoured too.
    window.scrollTo({ top, behavior: 'auto' })
  }

  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target
      // Canvas scrolling is the editor's own territory (see anchor-scroll).
      if (isEditMode() || !isHTMLElement(target)) {
        return
      }
      const wrapper = resolveWrapper(target)
      // :focus-visible keeps pointer focus out: scrolling a half-visible link
      // from under the cursor between mousedown and mouseup cancels its click.
      if (!wrapper || !target.matches(':focus-visible')) {
        return
      }
      // Two frames on, never here. WebKit runs its own focus scroll after
      // focusin, and late: one frame was not enough — under scroll-behavior:
      // smooth it replaced ours and left the control off stage (WebKit 27.2).
      // A scroller or carousel inside the panel also gets to bring the control
      // into its own view first.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!signal.aborted && document.activeElement === target) {
            follow(wrapper, target)
          }
        })
      )
    },
    { capture: true, signal }
  )
}
