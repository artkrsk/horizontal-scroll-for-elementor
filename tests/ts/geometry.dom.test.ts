// @vitest-environment happy-dom

import { computeInsetStart, layoutDocTop, layoutOffsetLeftWithin } from '@ts/geometry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nth, section } from './support'

/**
 * happy-dom has no layout, so the offsetParent chain is stated explicitly here.
 * That is the honest shape for these tests anyway: what layoutDocTop actually
 * promises is "sum offsetTop up the offsetParent chain, and never touch a
 * rect" (a positioned <body> aside), and both halves of that are assertable
 * without a layout engine.
 */
const chain = (tops: number[]): HTMLElement => {
  const els = tops.map(() => document.createElement('div'))
  els.forEach((el, i) => {
    Object.defineProperty(el, 'offsetTop', { value: tops[i], configurable: true })
    Object.defineProperty(el, 'offsetParent', { value: els[i + 1] ?? null, configurable: true })
  })
  return nth(els, 0)
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('layoutDocTop', () => {
  it('sums offsetTop up the offsetParent chain', () => {
    expect(layoutDocTop(chain([100, 250, 40]))).toBe(390)
  })

  it('returns the element own offset when the chain ends immediately', () => {
    expect(layoutDocTop(chain([512]))).toBe(512)
  })

  it('never consults a rect', () => {
    // The whole reason this walks the layout tree: rects include ancestor and
    // self transforms, and a widget-level entrance animation is mid-transform
    // exactly when a deep-link load correction measures.
    const el = chain([100, 60])
    const spy = vi.spyOn(el, 'getBoundingClientRect')

    layoutDocTop(el)

    expect(spy).not.toHaveBeenCalled()
  })
})

describe('layoutDocTop at the root', () => {
  /** A chain whose last link is <body>, as every in-flow element's is. */
  const underBody = (top: number): HTMLElement => {
    const el = document.body.appendChild(document.createElement('div'))
    Object.defineProperty(el, 'offsetTop', { value: top, configurable: true })
    Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true })
    // The spec's null for <body>; happy-dom computes none.
    Object.defineProperty(document.body, 'offsetParent', { value: null, configurable: true })
    return el
  }

  beforeEach(() => {
    // happy-dom computes no initial values: state the browser defaults.
    document.documentElement.setAttribute('style', 'overflow-y: visible')
    document.body.setAttribute('style', 'overflow-y: visible; position: static')
  })

  afterEach(() => {
    document.documentElement.removeAttribute('style')
    document.body.removeAttribute('style')
    vi.restoreAllMocks()
  })

  it("adds the root's margin the chain never sees (WP admin bar)", () => {
    document.documentElement.style.marginTop = '32px'

    expect(layoutDocTop(underBody(100))).toBe(132)
  })

  it('adds nothing without a root margin', () => {
    expect(layoutDocTop(underBody(100))).toBe(100)
  })

  it('adds the margin when the root clips but body does not scroll', () => {
    document.documentElement.style.marginTop = '32px'
    document.documentElement.style.overflowY = 'hidden'

    expect(layoutDocTop(underBody(100))).toBe(132)
  })

  it('stays scroller-relative when body is the scroller', () => {
    // Pro's page Scroll Snap: html overflow hidden, body auto.
    document.documentElement.style.marginTop = '32px'
    document.documentElement.style.overflowY = 'hidden'
    document.body.style.overflowY = 'auto'

    expect(layoutDocTop(underBody(100))).toBe(100)
  })

  it("measures from a positioned body's padding edge", () => {
    document.documentElement.style.marginTop = '32px'
    document.body.style.position = 'relative'
    vi.spyOn(document.body, 'getBoundingClientRect').mockReturnValue({ top: 40 } as DOMRect)

    expect(layoutDocTop(underBody(100))).toBe(140)
  })
})

describe('computeInsetStart', () => {
  it('uses the sticky offset when enough content sits above', () => {
    const { wrapper, track } = section({ docTop: 500, stickyTop: 80 })

    expect(computeInsetStart(wrapper, track)).toBe(80)
  })

  it('clamps to the document offset near the top of the page', () => {
    // With less than `offset` px above the widget, sticky is already stuck at
    // load and an unclamped range would begin before scroll 0 exists — the
    // track would sit pre-translated at rest, first panel visibly cut.
    const { wrapper, track } = section({ docTop: 20, stickyTop: 80 })

    expect(computeInsetStart(wrapper, track)).toBe(20)
  })

  it('is zero without a pin offset', () => {
    const { wrapper, track } = section({ docTop: 500, stickyTop: 0 })

    expect(computeInsetStart(wrapper, track)).toBe(0)
  })

  it('treats a non-numeric sticky top as no offset', () => {
    const { wrapper, track } = section({ docTop: 500 })
    track.style.top = 'auto'

    expect(computeInsetStart(wrapper, track)).toBe(0)
  })

  it('never returns a negative inset', () => {
    const { wrapper, track } = section({ docTop: 0, stickyTop: -50 })

    expect(computeInsetStart(wrapper, track)).toBe(0)
  })
})

describe('layoutOffsetLeftWithin', () => {
  /** A stated offsetParent link — happy-dom computes none. */
  const parentOf = (el: HTMLElement, parent: Element | null) =>
    Object.defineProperty(el, 'offsetParent', { value: parent, configurable: true })

  it('sums offsetLeft up to the track', () => {
    const track = document.body.appendChild(document.createElement('div'))
    const panel = track.appendChild(document.createElement('div'))
    const child = panel.appendChild(document.createElement('div'))
    Object.defineProperty(panel, 'offsetLeft', { value: 2000, configurable: true })
    Object.defineProperty(child, 'offsetLeft', { value: 200, configurable: true })
    parentOf(panel, track)
    parentOf(child, panel)

    expect(layoutOffsetLeftWithin(child, track)).toBe(2200)
  })

  it('never reads a rect, so a transformed element measures where it is laid out', () => {
    const track = document.body.appendChild(document.createElement('div'))
    const panel = track.appendChild(document.createElement('div'))
    Object.defineProperty(panel, 'offsetLeft', { value: 1000, configurable: true })
    parentOf(panel, track)
    const rect = vi.spyOn(panel, 'getBoundingClientRect')

    expect(layoutOffsetLeftWithin(panel, track)).toBe(1000)
    expect(rect).not.toHaveBeenCalled()
  })

  it('gives up when the chain never reaches the track', () => {
    const track = document.body.appendChild(document.createElement('div'))
    const stray = document.body.appendChild(document.createElement('div'))
    parentOf(stray, null)

    expect(layoutOffsetLeftWithin(stray, track)).toBeNull()
  })
})
