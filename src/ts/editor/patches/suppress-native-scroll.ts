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
type WithScrollToView = {
  scrollToView?: (this: unknown, $element: any, ...rest: any[]) => unknown
}

export const suppressNativeScrollForPanels = (): void => {
  // scrollToView is missing from the types package's HelpersManager
  // (another documented gap — see ../globals.d.ts).
  const helpers = elementor?.helpers as WithScrollToView | undefined
  if (!helpers || typeof helpers.scrollToView !== 'function') {
    return
  }

  const original = helpers.scrollToView

  helpers.scrollToView = function (this: unknown, $element: any, ...rest: any[]) {
    const el = $element?.[0] ?? $element
    // Duck-typed, not instanceof: preview elements belong to the iframe
    // realm, whose HTMLElement is a different constructor than ours.
    if (el && typeof el.closest === 'function' && el.closest('.js-arts-hs')) {
      return
    }
    return original.call(this, $element, ...rest)
  }
}
