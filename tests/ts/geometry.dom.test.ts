// @vitest-environment happy-dom

import { computeInsetStart, layoutDocTop } from '@ts/geometry'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nth, section } from './support'

/**
 * happy-dom has no layout, so the offsetParent chain is stated explicitly here.
 * That is the honest shape for these tests anyway: what layoutDocTop actually
 * promises is "sum offsetTop up the offsetParent chain, and never touch a
 * rect", and both halves of that are assertable without a layout engine.
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
