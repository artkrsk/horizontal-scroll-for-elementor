// Elementor scrolls the preview to any selected element via
// elementor.helpers.scrollToView — a jQuery animation writing scrollTop on
// html/body tick by tick. For content inside a pinned horizontal section
// that is categorically wrong: panels live at a scroll PROGRESS, so
// "element top" resolves to the section start for every one of them.
//
// Suppress it ONLY when the target element sits inside our widget —
// everything else keeps Elementor's native behavior.
//
// This is deliberately the WHOLE editor scroll story for panels: clicking
// a panel scrolls nothing. Auto-scrolling was tried and dropped: the preview
// ships `html { scroll-behavior: smooth }` (Elementor's own frontend CSS;
// themes add their own), which turns every
// programmatic scroll into a long ease fighting Elementor's own scroll
// actors (selection focus-scroll, repeater select replays). The user positions the
// canvas by scrolling the pin themselves.
import { WRAPPER_SELECTOR } from '../../contract'

export const suppressNativeScrollForPanels = (): void => {
  const helpers = elementor?.helpers
  if (!helpers || typeof helpers.scrollToView !== 'function') {
    return
  }

  const original = helpers.scrollToView

  helpers.scrollToView = function ($element: JQuery, ...rest: unknown[]) {
    const el = ($element as { 0?: Element })?.[0] ?? $element
    // Duck-typed, not instanceof: preview elements belong to the iframe
    // realm, whose HTMLElement is a different constructor than ours.
    if (
      el &&
      typeof (el as Element).closest === 'function' &&
      (el as Element).closest(WRAPPER_SELECTOR)
    ) {
      return
    }
    return original.call(this, $element, ...(rest as [number?, JQuery?]))
  }
}
