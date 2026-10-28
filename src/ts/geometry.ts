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
  let last = el
  while (isHTMLElement(node)) {
    top += node.offsetTop
    last = node
    node = node.offsetParent
  }
  return last === last.ownerDocument.body ? top + rootOffsetTop(last) : top
}

// What a chain ending at <body> leaves out: every engine measures a top-level
// element from the root's border box, so the root's own margin is in no term —
// WordPress's admin bar sets `html { margin-top: 32px }` (46px under 782px,
// kept under 600px where the bar stops being fixed). The computed margin, never
// the admin-bar var or class: the editor preview exposes the var with no bar,
// and a theme can move or drop the bump. Not html.offsetTop, which Firefox
// reports as 0.
const rootOffsetTop = (body: HTMLElement): number => {
  const root = body.ownerDocument.documentElement
  const bodyStyle = getComputedStyle(body)
  // Pro's page Scroll Snap makes body the scroller (html overflow hidden, body
  // auto): its scrollport already starts below the root margin, and the chain
  // is already scroller-relative.
  if (
    getComputedStyle(root).overflowY !== 'visible' &&
    !['visible', 'clip'].includes(bodyStyle.overflowY)
  ) {
    return 0
  }
  // A positioned body is the offsetParent proper: top-level elements measure
  // from its own box, so its margin (or one collapsing through it) and the
  // root's border and padding are missing too. Its rect is the one place a rect
  // is safe — nothing animates the body itself. A border on <body> is the one
  // case engines disagree on (Gecko is off by it), left as is.
  if (bodyStyle.position !== 'static') {
    return body.getBoundingClientRect().top + window.scrollY
  }
  return Number.parseFloat(getComputedStyle(root).marginTop) || 0
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
