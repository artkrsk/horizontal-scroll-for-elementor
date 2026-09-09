// Editor-only: why a pinned section isn't pinning.
//
// An ancestor whose overflow makes it a scroll container takes the sticky
// scrollport and the view-timeline scroller with it. The track then never
// scrubs, and every panel past the first stays hidden behind the runway's own
// `overflow-x: clip`. Nothing about that failure is visible — no console
// output, no layout hint — and the offending rule usually lives in the theme
// or the kit's custom CSS, where PHP can never see it. So: a runtime walk,
// surfaced in the one place the mistake gets made.
//
// Scope is deliberately narrow, and every rule below was measured in Chrome
// against a real pinned section rather than reasoned from the spec — the first
// draft of this file flagged three things that turn out to work fine.
//
// Does NOT block, verified: `transform`, `will-change`, `filter`,
// `perspective` (sticky keeps the same scrollport and no scroll container
// appears, and geometry.ts is built to tolerate them — see its offsetTop
// rationale); `overflow: clip` on either axis or both; `contain: size` on its
// own, and `contain: paint` / `layout` / `content`; `content-visibility: auto`.
// Elementor entrance animations, Motion FX and sticky headers set the first
// group constantly, so flagging them would fire on healthy sites and teach
// people to ignore this bar.
//
// Containment is left out altogether. `contain: size` alone works — the box
// collapses but its scrollable overflow still reaches the viewport. The
// combinations that do break (`strict`, `size layout`, `size paint`) are rare,
// and the paint ones clip this bar away too, so the warning could never be
// read. Same for `content-visibility: hidden`, which hides the section and the
// bar with it.
//
// The whole module is gated on window.ARTS_HS_DIAGNOSTICS, which PHP emits
// only on the Elementor preview request. On a public page it is absent and
// nothing here ever runs.
import { isScrubbing, resolveTrack } from './contract'
import { isHTMLElement } from './utils/isHTMLElement'

// Exported so phpParity.test.ts can hold the stylesheet to them: renamed on one
// side only, the bar renders unstyled — a zero-height positioner with nothing
// visible in it, which is the one failure this whole module exists to prevent.
export const DIAGNOSTIC_CLASS = 'arts-hs__diagnostic'
export const DIAGNOSTIC_MESSAGE_CLASS = 'arts-hs__diagnostic-message'
const BAR_HOOK_CLASS = 'js-arts-hs__diagnostic'

// The values that actually make an element a scroll container. Stated as the
// blocking set rather than the safe set on purpose: anything else — `visible`,
// `clip`, or a computed value we could not resolve — is not evidence of a
// problem, and this bar must never accuse on a guess.
const SCROLLING_OVERFLOW = new Set(['hidden', 'auto', 'scroll'])

// Everything that ends the root's `visible` state, `clip` included: an
// `overflow-x: clip` root still hands propagation over, verified in Chrome.
const NON_VISIBLE_OVERFLOW = new Set([...SCROLLING_OVERFLOW, 'clip'])

type TBlockerKind = 'overflow' | 'fixed'

/** What PHP hands us. Carried by argument from the one place that checks for
    it, so nothing downstream re-tests a global that cannot change mid-page. */
type TStrings = NonNullable<Window['ARTS_HS_DIAGNOSTICS']>

export interface IBlocker {
  kind: TBlockerKind
  /** The offending element, short enough to read in a one-line bar. */
  label: string
  /** The declaration that broke it, as computed. */
  declaration: string
}

const describe = (el: HTMLElement): string => {
  const id = el.id ? `#${el.id}` : ''
  const classes = Array.from(el.classList)
    .slice(0, 2)
    .map((name) => `.${name}`)
    .join('')
  return `${el.tagName.toLowerCase()}${id}${classes}`
}

// One axis is enough: CSS refuses to leave the other on `visible`, so a lone
// `overflow-x: hidden` (the rule that started this) computes to `hidden/auto`
// and takes the vertical scrollport with it.
const scrollingOverflow = (style: CSSStyleDeclaration): string | null => {
  const x = SCROLLING_OVERFLOW.has(style.overflowX) ? `overflow-x: ${style.overflowX}` : null
  const y = SCROLLING_OVERFLOW.has(style.overflowY) ? `overflow-y: ${style.overflowY}` : null
  if (!x || !y) {
    return x ?? y
  }
  // Both axes scroll, which is exactly what CSS produces when only ONE was
  // authored — the companion is forced to `auto`. Name the one the author
  // actually wrote, or telling them "overflow-x: auto" sends them hunting for a
  // rule that isn't in their stylesheet.
  return style.overflowX === 'auto' && style.overflowY !== 'auto' ? y : x
}

// The root's overflow propagates to the viewport. While the root is `visible`
// in both axes it is BODY's overflow that propagates instead, and body itself
// then behaves as `visible` — which is why `body { overflow-x: hidden }` on its
// own is harmless, and why `html { overflow-x: hidden }` on its own is too.
// Only once the root carries its own non-visible overflow does body stop
// propagating and become a real scroll container. That pairing is the reported
// bug, and the single-sided halves of it are the false alarms this guards.
//
// Do not re-add a Safari carve-out here. A cross-engine probe once showed
// Playwright's WebKit breaking on `body { overflow-x: hidden }` alone, which
// looked like an engine divergence worth warning about. It does not reproduce —
// the reading was a flaky first measurement after load, and repeat runs agree
// with Chromium and Firefox. Safari 26 was then checked by hand on the same
// page and pins correctly too. The old WebKit body-overflow bugs
// (webkit.org/b/240860, /b/153852) no longer apply here.
const rootOwnsPropagation = (doc: Document): boolean => {
  const root = getComputedStyle(doc.documentElement)
  return NON_VISIBLE_OVERFLOW.has(root.overflowX) || NON_VISIBLE_OVERFLOW.has(root.overflowY)
}

const inspect = (el: HTMLElement): IBlocker | null => {
  const doc = el.ownerDocument

  // The root can never be the trap: its overflow goes to the viewport, which is
  // the scroller the pin already resolves against.
  if (el === doc.documentElement) {
    return null
  }

  const style = getComputedStyle(el)
  const propagates = el === doc.body && !rootOwnsPropagation(doc)
  const overflow = propagates ? null : scrollingOverflow(style)
  if (overflow) {
    return { kind: 'overflow', label: describe(el), declaration: overflow }
  }

  // Nothing below a fixed ancestor participates in page scroll, so the timeline
  // has no traversal to resolve against — the page stops scrolling entirely.
  if (style.position === 'fixed') {
    return { kind: 'fixed', label: describe(el), declaration: 'position: fixed' }
  }

  return null
}

/**
 * The nearest ancestor that breaks the pin, or null. Starts at the parent, so
 * the runway's own `overflow-x: clip` and `container-type` are never
 * self-reported.
 */
export const findBlocker = (wrapper: HTMLElement): IBlocker | null => {
  let node: Element | null = wrapper.parentElement
  while (isHTMLElement(node)) {
    const blocker = inspect(node)
    if (blocker) {
      return blocker
    }
    node = node.parentElement
  }
  return null
}

const WARNING_SIGN = '\u26a0\ufe0f'

/**
 * Positional, so translators are free to swap the two around, and built as DOM
 * nodes rather than a string so the offending element and declaration can be
 * emphasised. Never innerHTML: the template is translator-supplied and the
 * label is assembled from page attributes, so neither is ever parsed as markup.
 */
const formatNodes = (
  doc: Document,
  template: string,
  label: string,
  declaration: string
): Node[] => {
  const values: Record<string, string> = { '%1$s': label, '%2$s': declaration }
  const nodes: Node[] = []
  for (const part of template.split(/(%[12]\$s)/)) {
    const value = values[part]
    if (value === undefined) {
      if (part) {
        nodes.push(doc.createTextNode(part))
      }
      continue
    }
    const strong = doc.createElement('strong')
    strong.textContent = value
    nodes.push(strong)
  }
  return nodes
}

// Direct children only: a section nested inside another section's panel keeps
// its own bar.
const clear = (wrapper: HTMLElement): void => {
  wrapper.querySelector(`:scope > .${BAR_HOOK_CLASS}`)?.remove()
}

const render = (wrapper: HTMLElement, blocker: IBlocker, strings: TStrings): void => {
  clear(wrapper)
  // The canvas is a foreign realm; build in the document that owns the wrapper.
  const doc = wrapper.ownerDocument

  const bar = doc.createElement('div')
  bar.className = `${DIAGNOSTIC_CLASS} ${BAR_HOOK_CLASS}`

  const message = doc.createElement('div')
  message.className = DIAGNOSTIC_MESSAGE_CLASS
  message.append(
    `${WARNING_SIGN} ${strings.blocked} `,
    ...formatNodes(doc, strings[blocker.kind], blocker.label, blocker.declaration)
  )

  bar.appendChild(message)
  wrapper.insertBefore(bar, wrapper.firstChild)
}

// The bar has to clear itself. Elementor applies a Container's Overflow
// control — and the kit's custom CSS — by rewriting a <style> element in the
// preview head: CSS injection, no re-render, so element_ready never fires
// again. Watching the head watches the actual signal, and it works both ways —
// the bar appears the moment the mistake is made and goes the moment it's
// undone. A mount-only check would instead sit there accusing the user of a
// rule they just deleted.
let styleObserver: MutationObserver | null = null
let disposeResize: (() => void) | null = null
let sweepTimer: ReturnType<typeof setTimeout> | null = null
const watched = new Set<HTMLElement>()

// A vertical state — touch, a vertical Layout breakpoint, a browser without
// support — is a plain stack with no pin for an ancestor to break, so the same
// ancestor overflow that is fatal at desktop width is harmless there. Measured:
// the demo page runs healthy at 700px with a live `html, body { overflow-x:
// hidden }`, and warned anyway until this gate went in.
const isPinning = (wrapper: HTMLElement): boolean => {
  const track = resolveTrack(wrapper)
  return track !== null && isScrubbing(track)
}

const sweep = (strings: TStrings): void => {
  for (const wrapper of watched) {
    // Same self-disconnect condition engine.ts's ResizeObserver uses: a canvas
    // re-render replaces the node rather than telling anyone.
    if (!wrapper.isConnected) {
      watched.delete(wrapper)
      continue
    }
    const blocker = isPinning(wrapper) ? findBlocker(wrapper) : null
    if (blocker) {
      render(wrapper, blocker, strings)
    } else {
      clear(wrapper)
    }
  }

  if (!watched.size) {
    styleObserver?.disconnect()
    styleObserver = null
    disposeResize?.()
    disposeResize = null
  }
}

// A real timer, not just a microtask: Elementor rewrites the style element on
// every keystroke inside a control, and each sweep forces a style recalc.
const requestSweep = (strings: TStrings): void => {
  if (sweepTimer !== null) {
    clearTimeout(sweepTimer)
  }
  sweepTimer = setTimeout(() => {
    sweepTimer = null
    sweep(strings)
  }, 150)
}

/** Called per widget mount, alongside boot(). No-op outside the editor preview. */
export const inspectSection = (wrapper: HTMLElement): void => {
  const strings = window.ARTS_HS_DIAGNOSTICS
  if (!strings) {
    return
  }
  watched.add(wrapper)
  if (!styleObserver) {
    const view = wrapper.ownerDocument.defaultView
    styleObserver = new MutationObserver(() => requestSweep(strings))
    styleObserver.observe(wrapper.ownerDocument.head, { childList: true, subtree: true })
    // Now that the verdict depends on the layout state, width changes matter:
    // Elementor's device switcher resizes the preview without touching the head.
    const onResize = () => requestSweep(strings)
    view?.addEventListener('resize', onResize)
    disposeResize = () => view?.removeEventListener('resize', onResize)
  }
  sweep(strings)
}
