// The wrapper's document offset from the layout tree, not from rects:
// getBoundingClientRect() includes ancestor/self transforms, and transient
// ones are real — a widget-level entrance animation translates the wrapper by
// its full height exactly when a deep-link load correction measures, and
// transforms never fire the ResizeObserver that would heal a skewed result.
// offsetTop sums are transform-immune.
export const layoutDocTop = (el: HTMLElement): number => {
  let top = 0
  let node: Element | null = el
  while (node instanceof HTMLElement) {
    top += node.offsetTop
    node = node.offsetParent
  }
  return top
}

// Range start must match what sticky actually does: with a pin offset and
// less than `offset` px of content above the widget, sticky is pre-stuck at
// load and the range would begin before scroll 0 — pre-translating the track
// at rest. Clamp to the wrapper's document offset (min(offset, docTop)).
export const computeInsetStart = (wrapper: HTMLElement, track: HTMLElement): number => {
  const stickyTop = Number.parseFloat(getComputedStyle(track).top) || 0
  return Math.max(0, Math.min(stickyTop, layoutDocTop(wrapper)))
}
