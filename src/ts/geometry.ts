import { isHTMLElement } from './utils/isHTMLElement'

// The wrapper's document offset from the layout tree, not from rects:
// getBoundingClientRect() includes ancestor/self transforms, and transient
// ones are real — a widget-level entrance animation translates the wrapper by
// its full height exactly when a deep-link load correction measures, and
// transforms never fire the ResizeObserver that would heal a skewed result.
// offsetTop sums are transform-immune.
export const layoutDocTop = (el: HTMLElement): number => {
  let top = 0
  let node: Element | null = el
  while (isHTMLElement(node)) {
    top += node.offsetTop
    node = node.offsetParent
  }
  return top
}

// The element's left offset inside the track, from the layout tree — the
// horizontal counterpart of layoutDocTop. A rect would include the track's own
// scrub translate and any effect transform on the element itself (parallax, an
// entrance animation). Null when the offsetParent chain never reaches the track:
// a fixed or detached element has no place in the traversal.
export const layoutOffsetLeftWithin = (el: HTMLElement, track: HTMLElement): number | null => {
  let left = 0
  let node: Element | null = el
  while (isHTMLElement(node) && node !== track) {
    left += node.offsetLeft
    node = node.offsetParent
  }
  return node === track ? left : null
}

// Range start must match what sticky actually does: with a pin offset and
// less than `offset` px of content above the widget, sticky is pre-stuck at
// load and the range would begin before scroll 0 — pre-translating the track
// at rest. Clamp to the wrapper's document offset (min(offset, docTop)).
export const computeInsetStart = (wrapper: HTMLElement, track: HTMLElement): number => {
  const stickyTop = Number.parseFloat(getComputedStyle(track).top) || 0
  return Math.max(0, Math.min(stickyTop, layoutDocTop(wrapper)))
}

// Progress fractions are clamped everywhere they are produced: a panel narrower
// than the leftover viewport, or a subject wider than the stage, otherwise
// pushes the ratio outside 0..1.
export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))
